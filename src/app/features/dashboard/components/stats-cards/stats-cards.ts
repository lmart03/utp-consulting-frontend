import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CalendarDays, CircleAlert, LucideAngularModule, LucideIconData, MailCheck, Ticket } from 'lucide-angular';

import { DashboardKpi, KpiKind } from '../../models/dashboard-kpi.model';

const ICONS: Record<KpiKind, LucideIconData> = {
  processed: MailCheck,
  jira: Ticket,
  meetings: CalendarDays,
  errors: CircleAlert,
};

@Component({
  selector: 'app-stats-cards',
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      @for (kpi of kpis(); track kpi.kind) {
        <article
          class="rounded-2xl border border-slate-200 bg-surface p-4 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md sm:p-5"
        >
          <div class="flex items-start justify-between gap-2">
            <p class="text-sm text-slate-500">{{ kpi.label }}</p>
            <span
              class="flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-300"
              [class]="iconClass(kpi)"
            >
              <lucide-icon [img]="icons[kpi.kind]" class="size-4" />
            </span>
          </div>
          <!-- track por valor: al cambiar, el número entra con un fade/slide corto -->
          @for (value of [kpi.value]; track value) {
            <p class="mt-2 animate-fade-in-up text-3xl font-semibold tabular-nums tracking-tight text-slate-900">{{ value }}</p>
          }
          <p class="mt-1 truncate text-xs text-slate-400">{{ kpi.hint }}</p>
        </article>
      }
    </div>
  `,
})
export class StatsCardsComponent {
  readonly kpis = input.required<DashboardKpi[]>();
  protected readonly icons = ICONS;

  protected iconClass(kpi: DashboardKpi): string {
    if (kpi.kind === 'errors') {
      return kpi.value > 0 ? 'bg-red-50 text-red-500' : 'bg-slate-100 text-slate-400';
    }
    return 'bg-emerald-50 text-emerald-600';
  }
}
