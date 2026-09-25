import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  Building2,
  CalendarDays,
  CircleAlert,
  CircleCheck,
  Clock,
  Contact,
  ExternalLink,
  Inbox,
  LucideAngularModule,
  Sparkles,
  Ticket,
  UserRound,
} from 'lucide-angular';

import { formatDay, formatDuration, formatTime, formatTimeRange } from '@shared/utils/date-format';
import { senderEmail } from '@shared/utils/email-address';

import { EmailProcess, PipelineStep, STEP_LABELS, STEP_ORDER } from '../../models/pipeline.model';
import { PROSPECT_FIELD_LABELS } from '../../models/prospect.model';
import { ProspectStatusBadgeComponent } from '../prospect-status-badge/prospect-status-badge';
import { ConnectorState, PipelineStepComponent } from '../pipeline-step/pipeline-step';
import { StatusBadgeComponent } from '../status-badge/status-badge';

@Component({
  selector: 'app-automation-pipeline',
  imports: [NgTemplateOutlet, LucideAngularModule, PipelineStepComponent, StatusBadgeComponent, ProspectStatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './automation-pipeline.html',
})
export class AutomationPipelineComponent {
  readonly process = input<EmailProcess | null>(null);
  readonly loading = input(false);
  /** card: tarjeta "Procesando ahora" del dashboard. drawer: contenido del detalle (siempre vertical). */
  readonly variant = input<'card' | 'drawer'>('card');

  protected readonly icons = { Building2, CalendarDays, CircleAlert, CircleCheck, Clock, Contact, ExternalLink, Inbox, Sparkles, Ticket, UserRound };
  protected readonly fieldLabels = PROSPECT_FIELD_LABELS;
  protected readonly formatTime = formatTime;
  protected readonly formatDay = formatDay;
  protected readonly formatTimeRange = formatTimeRange;
  protected readonly senderEmail = senderEmail;

  protected readonly isDrawer = computed(() => this.variant() === 'drawer');

  protected readonly steps = computed<{ step: PipelineStep; connector: ConnectorState }[]>(() => {
    const process = this.process();
    if (!process) {
      return [];
    }
    return STEP_ORDER.map((key, index) => {
      const step = process.steps[key];
      const nextKey = STEP_ORDER[index + 1];
      if (!nextKey) {
        return { step, connector: 'none' as const };
      }
      const next = process.steps[nextKey];
      const connector: ConnectorState =
        step.status === 'FAILED' || next.status === 'PENDING' ? 'pending' : next.status === 'PROCESSING' ? 'active' : 'done';
      return { step, connector };
    });
  });

  protected readonly inProgress = computed(() => {
    const process = this.process();
    return !!process && process.live && !process.finalStatus;
  });

  protected readonly geminiAnalyzing = computed(() => this.process()?.steps.gemini.status === 'PROCESSING');

  protected readonly failedSteps = computed(() =>
    Object.values(this.process()?.steps ?? {})
      .filter((step) => step.status === 'FAILED' && step.key !== 'done')
      .map((step) => ({ ...step, label: STEP_LABELS[step.key] })),
  );

  protected readonly doneStep = computed(() => this.process()?.steps.done);

  protected readonly resultCount = computed(() => {
    const p = this.process();
    return p ? [p.crm, p.jira, p.meeting].filter(Boolean).length : 0;
  });

  protected readonly resultsGridClass = computed(() => {
    if (this.isDrawer()) {
      return 'mt-6 grid gap-3';
    }
    return this.resultCount() >= 3 ? 'mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3' : 'mt-6 grid gap-3 sm:grid-cols-2';
  });

  protected missingText(fields: string[]): string {
    return fields.map((f) => this.fieldLabels[f as keyof typeof PROSPECT_FIELD_LABELS] ?? f).join(', ');
  }

  protected readonly duration = computed(() => formatDuration(this.process()?.elapsedMs));

  protected readonly stepsListClass = computed(() => (this.isDrawer() ? 'grid grid-cols-1' : 'grid grid-cols-1 lg:grid-cols-7 lg:gap-1'));
}
