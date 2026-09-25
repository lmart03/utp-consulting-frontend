import { ProcessedEmailStatus } from './processed-email.model';

/** Modelos de vista del pipeline: se construyen desde eventos WebSocket o desde el detalle REST. */
export type StepKey = 'gmail' | 'gemini' | 'jira' | 'calendar' | 'markRead' | 'done';
export type StepStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';

export const STEP_ORDER: readonly StepKey[] = ['gmail', 'gemini', 'jira', 'calendar', 'markRead', 'done'];

export const STEP_LABELS: Record<StepKey, string> = {
  gmail: 'Gmail',
  gemini: 'Gemini',
  jira: 'Jira',
  calendar: 'Calendar',
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
  jira?: JiraResult;
  meeting?: MeetingResult;
  /** true si se está siguiendo en tiempo real por WebSocket. */
  live: boolean;
}
