import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { ProspectStatus } from '../../models/prospect.model';

const BADGES: Record<ProspectStatus, { label: string; classes: string }> = {
  NEW: { label: 'Nuevo', classes: 'bg-slate-100 text-slate-600 ring-slate-500/10' },
  CONTACTED: { label: 'Contactado', classes: 'bg-slate-50 text-slate-700 ring-slate-500/20' },
  INTERESTED: { label: 'Interesado', classes: 'bg-emerald-50/70 text-emerald-700 ring-emerald-500/20' },
  MEETING_SCHEDULED: { label: 'Reunión agendada', classes: 'bg-emerald-50 text-emerald-700 ring-emerald-600/25' },
  CLIENT: { label: 'Cliente', classes: 'bg-emerald-600 text-white ring-emerald-600' },
  DISCARDED: { label: 'Descartado', classes: 'bg-red-50 text-red-700 ring-red-600/15' },
};

@Component({
  selector: 'app-prospect-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset transition-colors duration-300"
      [class]="badge().classes"
      [title]="status()"
    >{{ badge().label }}</span>
  `,
})
export class ProspectStatusBadgeComponent {
  readonly status = input.required<ProspectStatus>();
  protected readonly badge = computed(() => BADGES[this.status()] ?? BADGES.NEW);
}
