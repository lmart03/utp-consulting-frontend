import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CircleAlert, LucideAngularModule, RefreshCw } from 'lucide-angular';

import { AuthService } from '@core/services/auth.service';
import { ThemeService } from '@core/services/theme.service';
import { formatRelative } from '@shared/utils/date-format';

import { ActivityTimelineComponent } from '../../components/activity-timeline/activity-timeline';
import { AutomationPipelineComponent } from '../../components/automation-pipeline/automation-pipeline';
import { DashboardHeaderComponent } from '../../components/dashboard-header/dashboard-header';
import { EmailDetailDrawerComponent } from '../../components/email-detail-drawer/email-detail-drawer';
import { IntegrationsStatusComponent } from '../../components/integrations-status/integrations-status';
import { ProspectDrawerComponent } from '../../components/prospect-drawer/prospect-drawer';
import { ProspectsTableComponent } from '../../components/prospects-table/prospects-table';
import { RecentEmailsTableComponent } from '../../components/recent-emails-table/recent-emails-table';
import { StatsCardsComponent } from '../../components/stats-cards/stats-cards';
import { DashboardStore } from '../../stores/dashboard.store';

@Component({
  selector: 'app-dashboard-page',
  imports: [
    LucideAngularModule,
    DashboardHeaderComponent,
    StatsCardsComponent,
    AutomationPipelineComponent,
    ActivityTimelineComponent,
    IntegrationsStatusComponent,
    RecentEmailsTableComponent,
    EmailDetailDrawerComponent,
    ProspectsTableComponent,
    ProspectDrawerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-page.html',
})
export class DashboardPage {
  protected readonly store = inject(DashboardStore);
  protected readonly theme = inject(ThemeService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly user = this.auth.user;
  protected readonly alertIcon = CircleAlert;
  protected readonly refreshIcon = RefreshCw;

  /** Reloj de UI para "Última actualización: hace N s". */
  private readonly now = signal(Date.now());
  protected readonly lastUpdatedText = computed(() => formatRelative(this.store.lastUpdated(), this.now()));

  constructor() {
    this.store.init();
    const timer = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected logout(): void {
    this.auth.logout().subscribe(() => this.router.navigateByUrl('/login'));
  }
}
