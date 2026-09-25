import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Activity, LucideAngularModule } from 'lucide-angular';

import { formatTime } from '@shared/utils/date-format';

import { TimelineItem } from '../../models/pipeline.model';

const DOT_CLASSES: Record<TimelineItem['tone'], string> = {
  success: 'border-emerald-500 bg-emerald-500',
  processing: 'border-emerald-400 bg-surface',
  error: 'border-red-500 bg-red-500',
  neutral: 'border-slate-300 bg-surface',
};

@Component({
  selector: 'app-activity-timeline',
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section [class]="bare() ? '' : 'rounded-2xl border border-slate-200 bg-surface p-5 shadow-sm sm:p-6'">
      <div class="flex items-center gap-2">
        <lucide-icon [img]="activityIcon" class="size-4 text-slate-400" />
        <h2 class="text-sm font-semibold text-slate-900">Actividad</h2>
      </div>

      @if (visibleItems().length > 0) {
        <ol class="relative mt-5 space-y-4 before:absolute before:inset-y-1 before:left-[5px] before:w-px before:bg-slate-200">
          @for (item of visibleItems(); track item.id) {
            <li class="relative flex animate-fade-in-up gap-4 pl-0">
              <span class="relative z-10 mt-1.5 size-[11px] shrink-0 rounded-full border-2" [class]="dotClass(item)"></span>
              <div class="min-w-0">
                <p class="text-xs tabular-nums text-slate-400">{{ formatTime(item.timestamp, true) }}</p>
                <p class="text-sm" [class]="item.tone === 'error' ? 'text-red-600' : 'text-slate-700'">{{ item.text }}</p>
              </div>
            </li>
          }
        </ol>
      } @else {
        <p class="mt-4 text-sm text-slate-400">La actividad del procesamiento aparecerá aquí en tiempo real.</p>
      }
    </section>
  `,
})
export class ActivityTimelineComponent {
  readonly items = input<TimelineItem[]>([]);
  /** Sin tarjeta (para usar dentro del drawer). */
  readonly bare = input(false);
  readonly limit = input(12);

  protected readonly activityIcon = Activity;
  protected readonly formatTime = formatTime;
  protected readonly visibleItems = computed(() => this.items().slice(-this.limit()));

  protected dotClass(item: TimelineItem): string {
    return DOT_CLASSES[item.tone];
  }
}
