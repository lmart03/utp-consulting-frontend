import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, distinctUntilChanged, forkJoin, of, switchMap } from 'rxjs';

import { isToday } from '@shared/utils/date-format';

import { AutomationEvent, FINAL_STAGES } from '../models/automation-event.model';
import { AutomationStatus, IntegrationsStatus, LiveConnectionState } from '../models/automation-status.model';
import { DashboardKpi } from '../models/dashboard-kpi.model';
import { CALENDAR_TOOL, CRM_TOOL, JIRA_TOOL } from '../models/email-action.model';
import { EmailProcess } from '../models/pipeline.model';
import { ProcessedEmail } from '../models/processed-email.model';
import { Prospect, ProspectDetail } from '../models/prospect.model';
import { AutomationApiService } from '../services/automation-api.service';
import { AutomationWebsocketService } from '../services/automation-websocket.service';
import { CrmApiService } from '../services/crm-api.service';
import { applyEvent, createProcess, processFromDetail, processKey } from '../utils/pipeline-builder';

/**
 * Estado del dashboard. REST da la carga inicial; el WebSocket solo aplica cambios nuevos sobre el correo
 * afectado (procesos en memoria por gmailMessageId, enlazados a processedEmailId en cuanto llega).
 */
@Injectable()
export class DashboardStore {
  private readonly api = inject(AutomationApiService);
  private readonly socket = inject(AutomationWebsocketService);
  private readonly crmApi = inject(CrmApiService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _status = signal<AutomationStatus | null>(null);
  private readonly _integrations = signal<IntegrationsStatus | null>(null);
  private readonly _emails = signal<ProcessedEmail[]>([]);
  private readonly _loading = signal(true);
  private readonly _error = signal<string | null>(null);
  private readonly _processes = signal<Record<string, EmailProcess>>({});
  private readonly _activeKey = signal<string | null>(null);
  private readonly _featured = signal<EmailProcess | null>(null);
  private readonly _connection = signal<LiveConnectionState>('connecting');
  private readonly _lastUpdated = signal<number | null>(null);
  private readonly _liveCompleted = signal(0);
  private readonly _selectedId = signal<number | null>(null);
  private readonly _selectedDetail = signal<EmailProcess | null>(null);
  private readonly _detailLoading = signal(false);
  private readonly _prospects = signal<Prospect[]>([]);
  private readonly _prospectsLoading = signal(true);
  private readonly _prospectSearch = signal('');
  private readonly _selectedProspectId = signal<number | null>(null);
  private readonly _selectedProspect = signal<ProspectDetail | null>(null);
  private readonly _prospectLoading = signal(false);
  private readonly searchTerms = new Subject<string>();

  readonly status = this._status.asReadonly();
  readonly integrations = this._integrations.asReadonly();
  readonly emails = this._emails.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly connection = this._connection.asReadonly();
  readonly lastUpdated = this._lastUpdated.asReadonly();
  readonly detailLoading = this._detailLoading.asReadonly();
  readonly drawerOpen = computed(() => this._selectedId() !== null);
  readonly prospects = this._prospects.asReadonly();
  readonly prospectsLoading = this._prospectsLoading.asReadonly();
  readonly prospectSearch = this._prospectSearch.asReadonly();
  readonly selectedProspect = this._selectedProspect.asReadonly();
  readonly prospectLoading = this._prospectLoading.asReadonly();
  readonly prospectDrawerOpen = computed(() => this._selectedProspectId() !== null);

  readonly systemActive = computed(() => this._status()?.enabled ?? false);
  readonly connectedAccount = computed(() => this._status()?.googleAccount ?? null);

  /** "Procesando ahora": el último proceso seguido en vivo o, si no hay, el último correo registrado. */
  readonly activeProcess = computed<EmailProcess | null>(() => {
    const key = this._activeKey();
    return (key ? this._processes()[key] : null) ?? this._featured();
  });

  /** Detalle del drawer: si ese correo se está siguiendo en vivo se muestra la versión en vivo. */
  readonly selectedProcess = computed<EmailProcess | null>(() => {
    const id = this._selectedId();
    if (id === null) {
      return null;
    }
    const live = Object.values(this._processes()).find((p) => p.processedEmailId === id);
    return live ?? this._selectedDetail();
  });
  readonly selectedEmail = computed(() => this._emails().find((e) => e.id === this._selectedId()) ?? null);

  readonly kpis = computed<DashboardKpi[]>(() => {
    const status = this._status();
    const today = this._emails().filter((e) => isToday(e.createdAt));
    const liveCompleted = this._liveCompleted();
    return [
      {
        kind: 'processed',
        label: 'Procesados hoy',
        value: status?.totalToday ?? today.length,
        hint: liveCompleted > 0 ? `+${liveCompleted} en esta sesión` : 'Correos registrados hoy',
      },
      { kind: 'jira', label: 'Jira creados', value: today.filter((e) => !!e.jiraIssueKey).length, hint: 'Tickets de hoy' },
      { kind: 'meetings', label: 'Reuniones creadas', value: today.filter((e) => !!e.meetingStart).length, hint: 'Eventos de hoy' },
      {
        kind: 'errors',
        label: 'Errores',
        value: (status?.partial ?? 0) + (status?.failed ?? 0),
        hint: status?.partial ? `${status.partial} pendientes de reintento` : 'Parciales o fallidos',
      },
    ];
  });

  /** Carga inicial por REST y conexión en vivo. Se llama una vez desde la page. */
  init(): void {
    this.load();
    this.loadProspects();
    this.connectLive();
    this.searchTerms
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((term) => this.crmApi.getProspects(term).pipe(catchError(() => of(this._prospects())))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((prospects) => this._prospects.set(prospects));
  }

  /** Lista de contactos CRM (con el filtro actual). */
  loadProspects(): void {
    this._prospectsLoading.set(true);
    this.crmApi
      .getProspects(this._prospectSearch())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (prospects) => {
          this._prospects.set(prospects);
          this._prospectsLoading.set(false);
        },
        error: () => this._prospectsLoading.set(false),
      });
  }

  searchProspects(term: string): void {
    this._prospectSearch.set(term);
    this.searchTerms.next(term.trim());
  }

  openProspect(id: number): void {
    this._selectedProspectId.set(id);
    this._selectedProspect.set(null);
    this._prospectLoading.set(true);
    this.crmApi
      .getProspect(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          if (this._selectedProspectId() === id) {
            this._selectedProspect.set(detail);
          }
          this._prospectLoading.set(false);
        },
        error: () => this._prospectLoading.set(false),
      });
  }

  closeProspect(): void {
    this._selectedProspectId.set(null);
  }

  load(): void {
    this._loading.set(true);
    forkJoin({
      status: this.api.getStatus(),
      integrations: this.api.getIntegrations().pipe(catchError(() => of(null))),
      emails: this.api.getEmails(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ status, integrations, emails }) => {
          this._status.set(status);
          this._integrations.set(integrations);
          this._emails.set(emails);
          this._error.set(null);
          this._lastUpdated.set(Date.now());
          this._loading.set(false);
          if (emails.length > 0 && !this._featured()) {
            this.loadFeatured(emails[0].id);
          }
        },
        error: () => {
          this._error.set('No se pudo conectar con el backend de UTP Assistant.');
          this._loading.set(false);
        },
      });
  }

  openDetail(id: number): void {
    this._selectedId.set(id);
    this._selectedDetail.set(null);
    this._detailLoading.set(true);
    this.api
      .getEmailDetail(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          if (this._selectedId() === id) {
            this._selectedDetail.set(processFromDetail(detail));
          }
          this._detailLoading.set(false);
        },
        error: () => this._detailLoading.set(false),
      });
  }

  closeDetail(): void {
    this._selectedId.set(null);
  }

  private loadFeatured(id: number): void {
    this.api
      .getEmailDetail(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((detail) => this._featured.set(processFromDetail(detail)));
  }

  private connectLive(): void {
    this.socket
      .connect()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((message) => {
        if (message.type === 'event') {
          this.handleEvent(message.event);
          return;
        }
        const previous = this._connection();
        this._connection.set(message.state);
        // Al volver de una desconexión se resincroniza por REST lo que pudo perderse.
        if (message.state === 'live' && previous === 'reconnecting') {
          this.refreshSummary();
          this.loadProspects();
        }
      });
  }

  private handleEvent(event: AutomationEvent): void {
    const key = processKey(event);
    this._processes.update((processes) => ({
      ...processes,
      [key]: applyEvent(processes[key] ?? createProcess(event), event),
    }));
    this._activeKey.set(key);
    this._lastUpdated.set(Date.now());
    this.patchEmailRow(event);

    // Un contacto creado/actualizado por la automatización aparece en el listado CRM sin recargar la página.
    if (event.stage === 'TOOL_COMPLETED' && event.toolName === CRM_TOOL) {
      this.loadProspects();
      const prospectId = event.metadata?.['prospectId'];
      if (typeof prospectId === 'number' && this._selectedProspectId() === prospectId) {
        this.openProspect(prospectId);
      }
    }

    if (FINAL_STAGES.includes(event.stage)) {
      if (event.stage === 'PROCESS_COMPLETED' || event.stage === 'PROCESS_IGNORED') {
        this._liveCompleted.update((n) => n + 1);
      }
      if (event.processedEmailId != null) {
        this.refreshEmail(event.processedEmailId);
      }
      this.refreshSummary();
    }
  }

  /** Actualiza en la tabla solo la fila del correo del evento (sin recargar el listado). */
  private patchEmailRow(event: AutomationEvent): void {
    const id = event.processedEmailId;
    if (id == null) {
      return;
    }
    this._emails.update((emails) => {
      const index = emails.findIndex((e) => e.id === id);
      if (index === -1) {
        if (event.stage !== 'EMAIL_CLAIMED') {
          return emails;
        }
        const row: ProcessedEmail = {
          id,
          gmailMessageId: event.gmailMessageId ?? '',
          subject: event.subject,
          fromAddress: event.from,
          status: 'PROCESSING',
          attemptCount: 1,
          gmailMarkedRead: false,
          createdAt: event.timestamp,
          updatedAt: event.timestamp,
        };
        return [row, ...emails];
      }
      const current = emails[index];
      const patch: Partial<ProcessedEmail> = { updatedAt: event.timestamp };
      if (event.detectedCompany) {
        patch.detectedCompany = event.detectedCompany;
      }
      if (event.aiSummary) {
        patch.aiSummary = event.aiSummary;
      }
      if (event.stage === 'TOOL_COMPLETED' && event.toolName === CRM_TOOL) {
        patch.crmContactName = event.metadata?.['name'] as string | undefined;
        patch.crmStatus = event.metadata?.['status'] as string | undefined;
      }
      if (event.stage === 'TOOL_COMPLETED' && event.toolName === JIRA_TOOL) {
        patch.jiraIssueKey = event.externalId;
      }
      if (event.stage === 'TOOL_COMPLETED' && event.toolName === CALENDAR_TOOL) {
        patch.meetingStart = event.metadata?.['start'] as string | undefined;
        patch.meetingEnd = event.metadata?.['end'] as string | undefined;
      }
      if (!FINAL_STAGES.includes(event.stage) && current.status !== 'PROCESSING') {
        patch.status = 'PROCESSING';
      }
      const next = [...emails];
      next[index] = { ...current, ...patch };
      return next;
    });
  }

  /** Estado final autoritativo de un correo desde BD (duración, errores, reintento). */
  private refreshEmail(id: number): void {
    this.api
      .getEmailDetail(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((detail) => {
        this._emails.update((emails) =>
          emails.some((e) => e.id === id) ? emails.map((e) => (e.id === id ? detail.email : e)) : [detail.email, ...emails],
        );
        if (this._selectedId() === id) {
          this._selectedDetail.set(processFromDetail(detail));
        }
      });
  }

  /** KPIs e integraciones (conteos por estado). */
  private refreshSummary(): void {
    forkJoin({
      status: this.api.getStatus(),
      integrations: this.api.getIntegrations().pipe(catchError(() => of(this._integrations()))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ status, integrations }) => {
          this._status.set(status);
          this._integrations.set(integrations);
          this._lastUpdated.set(Date.now());
        },
        error: () => undefined,
      });
  }
}
