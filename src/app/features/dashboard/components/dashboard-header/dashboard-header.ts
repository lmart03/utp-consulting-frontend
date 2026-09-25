import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LogOut, LucideAngularModule, Workflow } from 'lucide-angular';

import { ThemeToggleComponent } from '@shared/components/theme-toggle/theme-toggle';

import { LiveConnectionState } from '../../models/automation-status.model';

@Component({
  selector: 'app-dashboard-header',
  imports: [LucideAngularModule, ThemeToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-header.html',
})
export class DashboardHeaderComponent {
  readonly userName = input<string | null>(null);
  readonly userEmail = input<string | null>(null);
  readonly systemActive = input(false);
  readonly connection = input<LiveConnectionState>('connecting');
  readonly darkMode = input(false);
  readonly logout = output<void>();
  readonly themeToggled = output<void>();

  protected readonly logoIcon = Workflow;
  protected readonly logoutIcon = LogOut;

  protected readonly initials = computed(() => {
    const source = this.userName() || this.userEmail() || '?';
    const parts = source.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
  });

  protected readonly connectionLabel = computed(() => {
    switch (this.connection()) {
      case 'live':
        return 'En vivo';
      case 'reconnecting':
        return 'Reconectando…';
      default:
        return 'Conectando…';
    }
  });
}
