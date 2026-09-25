import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Building2, Clock, LucideAngularModule, Timer, UserRound, X } from 'lucide-angular';

import { formatDay, formatDuration, formatTime } from '@shared/utils/date-format';
import { companyFromSender, senderEmail, senderName } from '@shared/utils/email-address';

import { EmailReply, ReplyAction } from '../../models/email-reply.model';
import { EmailProcess } from '../../models/pipeline.model';
import { ProcessedEmail } from '../../models/processed-email.model';
import { ActivityTimelineComponent } from '../activity-timeline/activity-timeline';
import { AutomationPipelineComponent } from '../automation-pipeline/automation-pipeline';
import { ReplyComposerComponent } from '../reply-composer/reply-composer';
import { StatusBadgeComponent } from '../status-badge/status-badge';

/** Drawer lateral con el detalle completo de un correo procesado. Siempre en el DOM para animar entrada y salida. */
@Component({
  selector: 'app-email-detail-drawer',
  imports: [LucideAngularModule, AutomationPipelineComponent, ActivityTimelineComponent, StatusBadgeComponent, ReplyComposerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './email-detail-drawer.html',
  host: { '(document:keydown.escape)': 'open() && closed.emit()' },
})
export class EmailDetailDrawerComponent {
  readonly open = input(false);
  readonly process = input<EmailProcess | null>(null);
  /** Fila de la tabla: permite mostrar el encabezado mientras carga el detalle. */
  readonly email = input<ProcessedEmail | null>(null);
  readonly loading = input(false);
  readonly replyBusy = input<ReplyAction | null>(null);
  readonly replyError = input<string | null>(null);
  readonly closed = output<void>();
  readonly sendReply = output<{ reply: EmailReply; body: string }>();
  readonly regenerateReply = output<EmailReply>();
  readonly discardReply = output<EmailReply>();

  protected readonly icons = { Building2, Clock, Timer, UserRound, X };
  protected readonly senderEmail = senderEmail;
  protected readonly senderName = senderName;

  protected readonly subject = computed(() => this.process()?.subject ?? this.email()?.subject ?? '');
  protected readonly from = computed(() => this.process()?.from ?? this.email()?.fromAddress ?? '');
  protected readonly company = computed(
    () => this.process()?.company ?? this.email()?.detectedCompany ?? companyFromSender(this.from()) ?? '—',
  );
  protected readonly status = computed(() => this.process()?.finalStatus ?? this.email()?.status ?? null);
  protected readonly received = computed(() => {
    const value = this.process()?.receivedAt ?? this.email()?.receivedAt ?? this.email()?.createdAt;
    return value ? `${formatDay(value)} · ${formatTime(value)}` : '—';
  });
  protected readonly duration = computed(() => formatDuration(this.process()?.elapsedMs ?? this.email()?.elapsedMs) || '—');
}
