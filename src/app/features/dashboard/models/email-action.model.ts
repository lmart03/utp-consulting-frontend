export type EmailActionStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';

export const JIRA_TOOL = 'crear_ticket_jira';
export const CALENDAR_TOOL = 'agendar_reunion_google_calendar';
export const CRM_TOOL = 'actualizar_contacto_crm';

/** Herramienta solicitada por Gemini y su resultado (EmailActionDto). */
export interface EmailAction {
  id: number;
  toolName: string;
  status: EmailActionStatus;
  externalId?: string;
  externalUrl?: string;
  requestPayload?: string;
  responsePayload?: string;
  errorMessage?: string;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
}
