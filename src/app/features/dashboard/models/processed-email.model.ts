import { EmailAction } from './email-action.model';
import { EmailReply, ReplyStatus } from './email-reply.model';

export type ProcessedEmailStatus = 'PROCESSING' | 'PROCESSED' | 'PARTIAL' | 'FAILED' | 'IGNORED';

/** GET /api/automation/emails (ProcessedEmailDto). */
export interface ProcessedEmail {
  id: number;
  gmailMessageId: string;
  threadId?: string;
  fromAddress?: string;
  subject?: string;
  receivedAt?: string;
  status: ProcessedEmailStatus;
  attemptCount: number;
  nextRetryAt?: string;
  errorMessage?: string;
  aiSummary?: string;
  detectedCompany?: string;
  gmailMarkedRead: boolean;
  processedAt?: string;
  elapsedMs?: number;
  jiraIssueKey?: string;
  meetingStart?: string;
  meetingEnd?: string;
  crmProspectId?: number;
  crmContactName?: string;
  crmStatus?: string;
  replyId?: number;
  replyStatus?: ReplyStatus;
  createdAt: string;
  updatedAt: string;
}

/** GET /api/automation/emails/{id} (ProcessedEmailDetailDto). */
export interface ProcessedEmailDetail {
  email: ProcessedEmail;
  actions: EmailAction[];
  reply?: EmailReply;
}
