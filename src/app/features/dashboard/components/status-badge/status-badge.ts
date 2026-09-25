import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { ProcessedEmailStatus } from '../../models/processed-email.model';

const BADGES: Record<ProcessedEmailStatus, { label: string; classes: string; dot: string }> = {
  PROCESSED: { label: 'Procesado', classes: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15', dot: 'bg-emerald-500' },
  PROCESSING: { label: 'En proceso', classes: 'bg-emerald-50/60 text-emerald-600 ring-emerald-400/25', dot: 'bg-emerald-400 animate-pulse' },
  PARTIAL: { label: 'Parcial', classes: 'bg-amber-50 text-amber-700 ring-amber-600/15', dot: 'bg-amber-500' },
  FAILED: { label: 'Fallido', classes: 'bg-red-50 text-red-700 ring-red-600/15', dot: 'bg-red-500' },
  IGNORED: { label: 'Ignorado', classes: 'bg-slate-100 text-slate-600 ring-slate-500/10', dot: 'bg-slate-400' },
};

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors duration-300 ease-out"
      [class]="badge().classes"
      [title]="status()"
    >
      <span class="size-1.5 rounded-full" [class]="badge().dot"></span>
      {{ badge().label }}
    </span>
  `,
})
export class StatusBadgeComponent {
  readonly status = input.required<ProcessedEmailStatus>();
  protected readonly badge = computed(() => BADGES[this.status()]);
}
