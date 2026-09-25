import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output, untracked } from '@angular/core';
import {
  CircleAlert,
  CircleCheck,
  LoaderCircle,
  LucideAngularModule,
  MessageSquareReply,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-angular';

import { formatShortDateTime } from '@shared/utils/date-format';

import { EmailReply, ReplyAction } from '../../models/email-reply.model';

const BADGES: Record<EmailReply['status'] | 'EDITED', { label: string; classes: string }> = {
  DRAFT: { label: 'Borrador IA', classes: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15' },
  EDITED: { label: 'Editado', classes: 'bg-amber-50 text-amber-700 ring-amber-600/15' },
  SENDING: { label: 'Enviando…', classes: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15' },
  SENT: { label: 'Enviada', classes: 'bg-emerald-500 text-white ring-emerald-500' },
  DISCARDED: { label: 'Descartada', classes: 'bg-slate-100 text-slate-500 ring-slate-500/10' },
  FAILED: { label: 'Error', classes: 'bg-red-50 text-red-700 ring-red-600/15' },
};

/**
 * Revisión de la respuesta sugerida por la IA: el usuario puede editarla, regenerarla, descartarla o enviarla.
 * Presentacional: comunica la intención por outputs y el store hace las llamadas.
 */
@Component({
  selector: 'app-reply-composer',
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reply-composer.html',
})
export class ReplyComposerComponent {
  readonly reply = input.required<EmailReply>();
  readonly busy = input<ReplyAction | null>(null);
  readonly error = input<string | null>(null);
  readonly send = output<string>();
  readonly regenerate = output<void>();
  readonly discard = output<void>();

  protected readonly icons = { CircleAlert, CircleCheck, LoaderCircle, MessageSquareReply, RotateCcw, Send, Sparkles, Trash2 };
  protected readonly formatShortDateTime = formatShortDateTime;

  /** Cambia solo si cambia el contenido del borrador (no cuando llega el mismo borrador en otro objeto). */
  private readonly replyKey = computed(() => `${this.reply().id}|${this.reply().status}|${this.reply().body ?? ''}`);
  /** Texto editable: se reinicia cuando llega otro borrador (p. ej. al regenerar). */
  protected readonly draft = linkedSignal({ source: this.replyKey, computation: () => untracked(this.reply).body ?? '' });
  /** Paso de confirmación antes de enviar; se cancela si cambia el borrador. */
  protected readonly confirming = linkedSignal({ source: this.replyKey, computation: () => false });

  protected readonly editable = computed(() => this.reply().status === 'DRAFT');
  protected readonly dirty = computed(() => this.draft().trim() !== (this.reply().body ?? '').trim());
  protected readonly canSend = computed(() => this.editable() && this.draft().trim().length > 0 && !this.busy());
  protected readonly badge = computed(() => {
    const reply = this.reply();
    const edited = reply.status === 'DRAFT' && (reply.edited || this.dirty());
    return BADGES[edited ? 'EDITED' : reply.status];
  });
  protected readonly errorText = computed(() => this.error() ?? (this.reply().status !== 'SENT' ? this.reply().errorMessage : null));

  protected onInput(event: Event): void {
    this.draft.set((event.target as HTMLTextAreaElement).value);
    this.confirming.set(false);
  }

  protected askConfirm(): void {
    if (this.canSend()) {
      this.confirming.set(true);
    }
  }

  protected confirmSend(): void {
    if (this.canSend()) {
      this.send.emit(this.draft().trim());
    }
  }
}
