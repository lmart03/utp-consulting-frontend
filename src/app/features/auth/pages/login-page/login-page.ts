import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CalendarDays, LucideAngularModule, Mail, Sparkles, Ticket, Workflow } from 'lucide-angular';

import { AuthService } from '@core/services/auth.service';
import { ThemeService } from '@core/services/theme.service';
import { ThemeToggleComponent } from '@shared/components/theme-toggle/theme-toggle';

@Component({
  selector: 'app-login-page',
  imports: [LucideAngularModule, ThemeToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login-page.html',
})
export class LoginPage {
  protected readonly theme = inject(ThemeService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly redirecting = signal(false);
  protected readonly logoIcon = Workflow;
  protected readonly integrations = [
    { label: 'Gmail', icon: Mail },
    { label: 'Gemini', icon: Sparkles },
    { label: 'Jira', icon: Ticket },
    { label: 'Calendar', icon: CalendarDays },
  ];

  constructor() {
    // Si ya hay sesión (p. ej. volvió del login de Google) va directo al dashboard.
    this.auth.loadCurrentUser().subscribe((user) => {
      if (user) {
        this.router.navigateByUrl('/');
      }
    });
  }

  protected continueWithGoogle(): void {
    this.redirecting.set(true);
    this.auth.loginWithGoogle();
  }
}
