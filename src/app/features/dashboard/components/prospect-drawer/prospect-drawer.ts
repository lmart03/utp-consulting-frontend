import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Building2, CircleAlert, Contact, LucideAngularModule, Mail, Phone, X } from 'lucide-angular';

import { formatDay, formatShortDateTime, formatTime } from '@shared/utils/date-format';

import { PROSPECT_FIELD_LABELS, ProspectDataSource, ProspectDetail } from '../../models/prospect.model';
import { ProspectStatusBadgeComponent } from '../prospect-status-badge/prospect-status-badge';

const SOURCE_LABELS: Record<ProspectDataSource, string> = {
  GEMINI: 'detectado por IA',
  MANUAL: 'ingresado manualmente',
  FROM_HEADER: 'deducido del remitente',
  EMAIL_ADDRESS: 'deducido del email',
  EMAIL_DOMAIN: 'deducido del dominio',
};

/** Ficha del contacto CRM con su historial. Siempre en el DOM para animar entrada/salida. */
@Component({
  selector: 'app-prospect-drawer',
  imports: [LucideAngularModule, ProspectStatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './prospect-drawer.html',
  host: { '(document:keydown.escape)': 'open() && closed.emit()' },
})
export class ProspectDrawerComponent {
  readonly open = input(false);
  readonly detail = input<ProspectDetail | null>(null);
  readonly loading = input(false);
  readonly closed = output<void>();

  protected readonly icons = { Building2, CircleAlert, Contact, Mail, Phone, X };
  protected readonly formatShortDateTime = formatShortDateTime;
  protected readonly formatDay = formatDay;
  protected readonly formatTime = formatTime;

  protected readonly missingText = computed(() =>
    (this.detail()?.prospect.missingFields ?? []).map((f) => PROSPECT_FIELD_LABELS[f]).join(', '),
  );

  protected sourceLabel(source?: ProspectDataSource): string {
    return source ? SOURCE_LABELS[source] : '';
  }
}
