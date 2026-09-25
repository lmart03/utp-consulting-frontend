import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ChevronRight, Inbox, LucideAngularModule } from 'lucide-angular';

import { formatDuration, formatShortDateTime, formatTime } from '@shared/utils/date-format';
import { companyFromSender, senderEmail } from '@shared/utils/email-address';

import { ProcessedEmail } from '../../models/processed-email.model';
import { StatusBadgeComponent } from '../status-badge/status-badge';

@Component({
  selector: 'app-recent-emails-table',
  imports: [LucideAngularModule, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recent-emails-table.html',
})
export class RecentEmailsTableComponent {
  readonly emails = input<ProcessedEmail[]>([]);
  readonly loading = input(false);
  readonly selectedId = input<number | null>(null);
  readonly selectEmail = output<number>();

  protected readonly inboxIcon = Inbox;
  protected readonly chevronIcon = ChevronRight;
  protected readonly senderEmail = senderEmail;
  protected readonly formatTime = formatTime;
  protected readonly formatDuration = formatDuration;
  protected readonly formatShortDateTime = formatShortDateTime;

  protected company(email: ProcessedEmail): string {
    return email.detectedCompany || companyFromSender(email.fromAddress) || '—';
  }
}
