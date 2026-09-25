/** Respuesta sugerida por la IA (EmailReplyDto). Nunca se envía sola: el usuario la revisa y la envía. */
export type ReplyStatus = 'DRAFT' | 'SENDING' | 'SENT' | 'DISCARDED' | 'FAILED';

export interface EmailReply {
  id: number;
  processedEmailId: number;
  toAddress: string;
  subject?: string;
  body?: string;
  /** El usuario modificó el texto generado por la IA. */
  edited: boolean;
  status: ReplyStatus;
  errorMessage?: string;
  sentAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Acción del usuario sobre el borrador en curso (para deshabilitar botones y mostrar spinner). */
export type ReplyAction = 'send' | 'regenerate' | 'discard';
