import { EmailReply } from './email-reply.model';
import { ProcessedEmailStatus } from './processed-email.model';
import { ProspectField, ProspectStatus } from './prospect.model';

/** Modelos de vista del pipeline: se construyen desde eventos WebSocket o desde el detalle REST. */
export type StepKey = 'gmail' | 'gemini' | 'crm' | 'jira' | 'calendar' | 'reply' | 'markRead' | 'done';
export type StepStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';

export const STEP_ORDER: readonly StepKey[] = ['gmail', 'gemini', 'crm', 'jira', 'calendar', 'reply', 'markRead', 'done'];

export const STEP_LABELS: Record<StepKey, string> = {
  gmail: 'Gmail',
  gemini: 'Gemini',
  crm: 'CRM',
  jira: 'Jira',
  calendar: 'Calendar',
  reply: 'Respuesta',
  markRead: 'Gmail leído',
  done: 'Completado',
};

export interface PipelineStep {
  key: StepKey;
  status: StepStatus;
  timestamp?: string;
  /** Texto secundario: "3 acciones detectadas", "SCRUM-14", "26/09 15:00 – 16:00"… */
  detail?: string;
  error?: string;
  attempt?: number;
  maxAttempts?: number;
  nextRetryAt?: string;
}

export interface TimelineItem {
  id: string;
  timestamp: string;
  text: string;
  tone: 'success' | 'processing' | 'error' | 'neutral';
}

export interface JiraResult {
  key: string;
  url?: string;
}

/** Contacto del CRM creado/actualizado por el correo. */
export interface CrmResult {
  prospectId?: number;
  name?: string;
  email?: string;
  company?: string;
  status?: ProspectStatus;
  created?: boolean;
  missingFields: ProspectField[];
  inferredFields: ProspectField[];
}

export interface MeetingResult {
  start?: string;
  end?: string;
  url?: string;
}

/** Proceso de un correo, en vivo o reconstruido desde BD. */
export interface EmailProcess {
  gmailMessageId: string;
  processedEmailId?: number;
  subject?: string;
  from?: string;
  company?: string;
  aiSummary?: string;
  toolsDetected?: number;
  receivedAt?: string;
  startedAt: string;
  elapsedMs?: number;
  finalStatus?: ProcessedEmailStatus;
  steps: Record<StepKey, PipelineStep>;
  timeline: TimelineItem[];
  crm?: CrmResult;
  jira?: JiraResult;
  meeting?: MeetingResult;
  /** Respuesta sugerida por la IA (borrador, enviada, descartada o fallida). */
  reply?: EmailReply;
  /** true si se está siguiendo en tiempo real por WebSocket. */
  live: boolean;
}
