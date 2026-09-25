import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  CalendarDays,
  Check,
  CircleCheck,
  LucideAngularModule,
  LucideIconData,
  Mail,
  MailCheck,
  Minus,
  Sparkles,
  Ticket,
  X,
} from 'lucide-angular';

import { formatTime } from '@shared/utils/date-format';

import { PipelineStep, STEP_LABELS, StepKey, StepStatus } from '../../models/pipeline.model';

/** Estado de la línea que une esta etapa con la siguiente. */
export type ConnectorState = 'none' | 'pending' | 'active' | 'done';

const STEP_ICONS: Record<StepKey, LucideIconData> = {
  gmail: Mail,
  gemini: Sparkles,
  jira: Ticket,
  calendar: CalendarDays,
  markRead: MailCheck,
  done: CircleCheck,
};

const STATUS_TEXT: Record<StepStatus, string> = {
  PENDING: 'Pendiente',
  PROCESSING: 'En proceso',
  SUCCESS: 'Completado',
  FAILED: 'Error',
  SKIPPED: 'Omitido',
};

@Component({
  selector: 'li[app-pipeline-step]',
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pipeline-step.html',
  host: { '[class]': 'itemClass()' },
})
export class PipelineStepComponent {
  readonly step = input.required<PipelineStep>();
  readonly connector = input<ConnectorState>('none');
  /** true: siempre vertical (drawer). false: vertical en mobile y horizontal desde lg. */
  readonly vertical = input(false);

  protected readonly checkIcon = Check;
  protected readonly failIcon = X;
  protected readonly skipIcon = Minus;
  protected readonly formatTime = formatTime;

  protected readonly label = computed(() => STEP_LABELS[this.step().key]);
  protected readonly icon = computed(() => STEP_ICONS[this.step().key]);
  protected readonly statusText = computed(() => STATUS_TEXT[this.step().status]);

  protected readonly itemClass = computed(() =>
    this.vertical()
      ? 'relative flex gap-4 pb-7 last:pb-0'
      : 'relative flex gap-4 pb-7 last:pb-0 lg:flex-col lg:items-center lg:gap-3 lg:pb-0 lg:text-center',
  );

  protected readonly bodyClass = computed(() => {
    const base = 'min-w-0 flex-1 pt-1.5 transition-opacity duration-300 ease-out';
    const dim = this.step().status === 'PENDING' ? ' opacity-60' : '';
    return (this.vertical() ? base : `${base} lg:w-full lg:pt-0`) + dim;
  });

  protected readonly nodeClass = computed(() => {
    const base = 'relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 ease-out';
    switch (this.step().status) {
      case 'PROCESSING':
        return `${base} border-emerald-400 bg-emerald-50 text-emerald-600 animate-soft-pulse`;
      case 'SUCCESS':
        return `${base} border-emerald-500 bg-emerald-500 text-white shadow-sm`;
      case 'FAILED':
        return `${base} border-red-500 bg-red-500 text-white shadow-sm`;
      case 'SKIPPED':
        return `${base} border-slate-200 bg-slate-100 text-slate-400`;
      default:
        return `${base} border-slate-200 bg-white text-slate-400`;
    }
  });

  protected readonly statusTextClass = computed(() => {
    switch (this.step().status) {
      case 'PROCESSING':
        return 'text-emerald-600';
      case 'SUCCESS':
        return 'text-emerald-600';
      case 'FAILED':
        return 'text-red-600';
      default:
        return 'text-slate-400';
    }
  });

  protected readonly connectorClass = computed(() => {
    const vertical = 'absolute left-5 top-12 bottom-1 w-0.5 -translate-x-1/2 overflow-hidden rounded-full';
    const horizontal =
      ' lg:left-[calc(50%+1.75rem)] lg:right-[calc(-50%+1.75rem)] lg:top-5 lg:bottom-auto lg:h-0.5 lg:w-auto lg:translate-x-0';
    const color = this.connector() === 'active' ? ' bg-emerald-100' : ' bg-slate-200';
    return (this.vertical() ? vertical : vertical + horizontal) + color;
  });

  /** Relleno verde que "crece" cuando el flujo pasa a la siguiente etapa. */
  protected readonly fillClass = computed(() => {
    const filled = this.connector() === 'done';
    const base = 'absolute inset-0 bg-emerald-500 transition-transform duration-500 ease-out';
    if (this.vertical()) {
      return `${base} origin-top ${filled ? 'scale-y-100' : 'scale-y-0'}`;
    }
    return `${base} origin-top lg:origin-left ${filled ? 'scale-y-100 lg:scale-x-100' : 'scale-y-0 lg:scale-y-100 lg:scale-x-0'}`;
  });

  protected readonly flowClass = computed(() =>
    this.vertical()
      ? 'hidden'
      : 'absolute inset-y-0 left-0 hidden w-1/3 animate-flow bg-gradient-to-r from-transparent via-emerald-400 to-transparent lg:block',
  );
}
