import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideAngularModule, Moon, Sun } from 'lucide-angular';

/** Botón sol/luna. Presentacional: recibe el estado y emite la intención de cambiar. */
@Component({
  selector: 'app-theme-toggle',
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      (click)="toggled.emit()"
      class="relative flex size-9 items-center justify-center rounded-lg text-slate-500 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700"
      [attr.aria-label]="dark() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
      [title]="dark() ? 'Modo claro' : 'Modo oscuro'"
    >
      @for (mode of [dark()]; track mode) {
        <lucide-icon [img]="mode ? sunIcon : moonIcon" class="size-4 animate-scale-in" />
      }
    </button>
  `,
})
export class ThemeToggleComponent {
  readonly dark = input(false);
  readonly toggled = output<void>();

  protected readonly sunIcon = Sun;
  protected readonly moonIcon = Moon;
}
