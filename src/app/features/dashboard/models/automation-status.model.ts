/** GET /api/automation/status (StatusDto). */
export interface AutomationStatus {
  enabled: boolean;
  pollingIntervalMs: number;
  automationStartedAt?: string;
  processOldEmails: boolean;
  googleAccount?: string;
  running: boolean;
  lastRun?: AutomationRunResult;
  processing: number;
  processed: number;
  ignored: number;
  partial: number;
  failed: number;
  totalToday: number;
}

export interface AutomationRunResult {
  executed: boolean;
  message: string;
  newEmails: number;
  retried: number;
  skipped: number;
  errors: number;
  finishedAt?: string;
}

/** GET /api/automation/integrations (IntegrationsStatusDto). */
export interface IntegrationsStatus {
  gmail: IntegrationInfo;
  gemini: IntegrationInfo;
  jira: IntegrationInfo;
  calendar: IntegrationInfo;
  /** Ausente en backends anteriores al CRM. */
  crm?: IntegrationInfo;
}

export interface IntegrationInfo {
  connected: boolean;
  configured: boolean;
  account?: string;
  model?: string;
  projectKey?: string;
  baseUrl?: string;
  calendarId?: string;
  timeZone?: string;
}

/** Estado de la conexión STOMP mostrado en el header. */
export type LiveConnectionState = 'connecting' | 'live' | 'reconnecting';
