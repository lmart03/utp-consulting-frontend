/** Evento publicado por el backend en /topic/automation (AutomationEvent.java). */
export type AutomationStage =
  | 'EMAIL_DETECTED'
  | 'EMAIL_CLAIMED'
  | 'AI_ANALYSIS_STARTED'
  | 'AI_ANALYSIS_COMPLETED'
  | 'TOOL_STARTED'
  | 'TOOL_COMPLETED'
  | 'TOOL_FAILED'
  | 'TOOL_SKIPPED'
  | 'MARK_READ_STARTED'
  | 'MARK_READ_COMPLETED'
  | 'MARK_READ_FAILED'
  | 'PROCESS_COMPLETED'
  | 'PROCESS_PARTIAL'
  | 'PROCESS_FAILED'
  | 'PROCESS_IGNORED';

export type AutomationEventStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';

export interface AutomationEvent {
  /** Ausente en EMAIL_DETECTED (el correo aún no se registró en BD). */
  processedEmailId?: number;
  gmailMessageId?: string;
  subject?: string;
  from?: string;
  detectedCompany?: string;
  stage: AutomationStage;
  status: AutomationEventStatus;
  message?: string;
  toolName?: string;
  externalId?: string;
  externalUrl?: string;
  aiSummary?: string;
  timestamp: string;
  elapsedMs?: number;
  /** toolsDetected, attempt, maxAttempts, start, end, finalStatus… según la etapa. */
  metadata?: Record<string, unknown>;
  error?: string;
}

export const FINAL_STAGES: readonly AutomationStage[] = [
  'PROCESS_COMPLETED',
  'PROCESS_PARTIAL',
  'PROCESS_FAILED',
  'PROCESS_IGNORED',
];
