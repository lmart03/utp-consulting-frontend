import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CalendarDays, LucideAngularModule, Mail, Plug, Sparkles, Ticket } from 'lucide-angular';

import { IntegrationsStatus } from '../../models/automation-status.model';

@Component({
  selector: 'app-integrations-status',
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div class="flex items-center gap-2">
        <lucide-icon [img]="plugIcon" class="size-4 text-slate-400" />
        <h2 class="text-sm font-semibold text-slate-900">Integraciones</h2>
      </div>

      @if (items(); as list) {
        <ul class="mt-4 space-y-3">
          @for (item of list; track item.name) {
            <li class="flex items-center gap-3">
              <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
                <lucide-icon [img]="item.icon" class="size-4" />
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-slate-900">{{ item.name }}</p>
                @if (item.detail) {
                  <p class="truncate text-xs text-slate-400" [title]="item.detail">{{ item.detail }}</p>
                }
              </div>
              <span
                class="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium transition-colors duration-300"
                [class]="item.ok ? 'text-emerald-600' : 'text-slate-400'"
              >
                <span class="size-1.5 rounded-full" [class]="item.ok ? 'bg-emerald-500' : 'bg-slate-300'"></span>
                {{ item.label }}
              </span>
            </li>
          }
        </ul>
      } @else {
        <ul class="mt-4 space-y-3">
          @for (row of [1, 2, 3, 4]; track row) {
            <li class="flex animate-pulse items-center gap-3">
              <span class="size-8 rounded-lg bg-slate-200"></span>
              <span class="h-3 flex-1 rounded bg-slate-200"></span>
              <span class="h-3 w-16 rounded bg-slate-200"></span>
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class IntegrationsStatusComponent {
  readonly integrations = input<IntegrationsStatus | null>(null);

  protected readonly plugIcon = Plug;

  protected readonly items = computed(() => {
    const status = this.integrations();
    if (!status) {
      return null;
    }
    return [
      { name: 'Gmail', icon: Mail, ok: status.gmail.connected, label: status.gmail.connected ? 'Conectado' : 'Sin sesión', detail: status.gmail.account },
      { name: 'Gemini', icon: Sparkles, ok: status.gemini.configured, label: status.gemini.configured ? 'Configurado' : 'Sin API key', detail: status.gemini.model },
      {
        name: 'Jira',
        icon: Ticket,
        ok: status.jira.configured,
        label: status.jira.configured ? 'Conectado' : 'Sin configurar',
        detail: status.jira.projectKey ? `Proyecto ${status.jira.projectKey}` : undefined,
      },
      {
        name: 'Calendar',
        icon: CalendarDays,
        ok: status.calendar.connected,
        label: status.calendar.connected ? 'Conectado' : 'Sin sesión',
        detail: status.calendar.timeZone,
      },
    ];
  });
}
