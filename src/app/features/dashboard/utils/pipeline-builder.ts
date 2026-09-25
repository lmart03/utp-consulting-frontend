import { formatDay, formatTimeRange } from '@shared/utils/date-format';
import { companyFromSender } from '@shared/utils/email-address';

import { AutomationEvent, FINAL_STAGES } from '../models/automation-event.model';
import { CALENDAR_TOOL, CRM_TOOL, EmailAction, JIRA_TOOL } from '../models/email-action.model';
import { EmailReply } from '../models/email-reply.model';
import { ProspectField, ProspectStatus } from '../models/prospect.model';
import {
  CrmResult,
  EmailProcess,
  MeetingResult,
  PipelineStep,
  STEP_LABELS,
  STEP_ORDER,
  StepKey,
  StepStatus,
  TimelineItem,
} from '../models/pipeline.model';
import { ProcessedEmailDetail } from '../models/processed-email.model';

/**
 * Funciones puras que construyen el pipeline visual de un correo:
 * - applyEvent: aplica un evento WebSocket (en vivo).
 * - processFromDetail: lo reconstruye desde GET /api/automation/emails/{id} (carga inicial / historial).
 */

function emptySteps(): Record<StepKey, PipelineStep> {
  return Object.fromEntries(STEP_ORDER.map((key) => [key, { key, status: 'PENDING' as StepStatus }])) as Record<
    StepKey,
    PipelineStep
  >;
}

/** Clave estable del proceso: todos los eventos traen gmailMessageId (EMAIL_DETECTED aún no tiene processedEmailId). */
export function processKey(event: Pick<AutomationEvent, 'gmailMessageId' | 'processedEmailId'>): string {
  return event.gmailMessageId ?? `id-${event.processedEmailId}`;
}

export function createProcess(event: AutomationEvent): EmailProcess {
  return {
    gmailMessageId: processKey(event),
    processedEmailId: event.processedEmailId,
    startedAt: event.timestamp,
    steps: emptySteps(),
    timeline: [],
    live: true,
  };
}

function toolStep(toolName?: string): StepKey | null {
  if (toolName === CRM_TOOL) {
    return 'crm';
  }
  if (toolName === JIRA_TOOL) {
    return 'jira';
  }
  if (toolName === CALENDAR_TOOL) {
    return 'calendar';
  }
  return null;
}

function meetingText(meeting?: MeetingResult): string | undefined {
  if (!meeting?.start) {
    return undefined;
  }
  return `${formatDay(meeting.start)} · ${formatTimeRange(meeting.start, meeting.end)}`;
}

function fieldList(value: unknown): ProspectField[] {
  return Array.isArray(value) ? (value.filter((v) => v === 'name' || v === 'company' || v === 'phone') as ProspectField[]) : [];
}

/** Contacto CRM desde la metadata del evento o desde el ProspectResponse guardado como responsePayload. */
function crmFrom(source: Record<string, unknown> | undefined, prospectId?: number): CrmResult | undefined {
  if (!source) {
    return undefined;
  }
  const id = typeof source['prospectId'] === 'number' ? (source['prospectId'] as number) : typeof source['id'] === 'number' ? (source['id'] as number) : prospectId;
  return {
    prospectId: id,
    name: typeof source['name'] === 'string' ? (source['name'] as string) : undefined,
    email: typeof source['email'] === 'string' ? (source['email'] as string) : undefined,
    company: typeof source['company'] === 'string' ? (source['company'] as string) : undefined,
    status: typeof source['status'] === 'string' ? (source['status'] as ProspectStatus) : undefined,
    created: typeof source['created'] === 'boolean' ? (source['created'] as boolean) : undefined,
    missingFields: fieldList(source['missingFields']),
    inferredFields: fieldList(source['inferredFields']),
  };
}

function parseJson(value?: string): Record<string, unknown> | undefined {
  if (!value) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function crmDetail(crm: CrmResult): string {
  const who = crm.name ?? crm.email ?? 'Contacto';
  return crm.created === undefined ? who : `${who} · ${crm.created ? 'nuevo' : 'actualizado'}`;
}

const TOOL_WORKING_TEXT: Record<'crm' | 'jira' | 'calendar', string> = {
  crm: 'Actualizando contacto',
  jira: 'Creando ticket',
  calendar: 'Agendando reunión',
};

function numberMeta(event: AutomationEvent, key: string): number | undefined {
  const value = event.metadata?.[key];
  return typeof value === 'number' ? value : undefined;
}

function stringMeta(event: AutomationEvent, key: string): string | undefined {
  const value = event.metadata?.[key];
  return typeof value === 'string' ? value : undefined;
}

/** Estado visual de la etapa "Respuesta" según el borrador. */
export function replyStep(reply: EmailReply): PipelineStep {
  const timestamp = reply.sentAt ?? reply.updatedAt ?? reply.createdAt;
  switch (reply.status) {
    case 'DRAFT':
      return { key: 'reply', status: 'SUCCESS', timestamp, detail: reply.edited ? 'Editada · por revisar' : 'Por revisar' };
    case 'SENDING':
      return { key: 'reply', status: 'PROCESSING', timestamp, detail: 'Enviando…' };
    case 'SENT':
      return { key: 'reply', status: 'SUCCESS', timestamp, detail: 'Enviada' };
    case 'DISCARDED':
      return { key: 'reply', status: 'SKIPPED', timestamp, detail: 'Descartada' };
    default:
      return { key: 'reply', status: 'FAILED', timestamp, error: reply.errorMessage ?? 'No se pudo redactar la respuesta.' };
  }
}

/** Aplica al proceso el borrador devuelto por el backend (tras enviar, regenerar o descartar). */
export function withReply(process: EmailProcess, reply: EmailReply): EmailProcess {
  const timeline = [...process.timeline];
  if (reply.status === 'SENT' && reply.sentAt && !timeline.some((item) => item.id === `reply-sent-${reply.id}`)) {
    timeline.push({ id: `reply-sent-${reply.id}`, timestamp: reply.sentAt, text: `Respuesta enviada a ${reply.toAddress}`, tone: 'success' });
  }
  return { ...process, reply, steps: { ...process.steps, reply: replyStep(reply) }, timeline };
}

function replyFromEvent(event: AutomationEvent, status: EmailReply['status']): EmailReply | undefined {
  const id = numberMeta(event, 'replyId');
  if (id === undefined || event.processedEmailId == null) {
    return undefined;
  }
  return {
    id,
    processedEmailId: event.processedEmailId,
    toAddress: stringMeta(event, 'to') ?? '',
    subject: stringMeta(event, 'subject'),
    body: stringMeta(event, 'body'),
    edited: false,
    status,
    errorMessage: event.error,
    createdAt: event.timestamp,
    updatedAt: event.timestamp,
  };
}

/** Aplica un evento WebSocket al proceso (inmutable). */
export function applyEvent(current: EmailProcess, event: AutomationEvent): EmailProcess {
  const next: EmailProcess = {
    ...current,
    steps: { ...current.steps },
    timeline: [...current.timeline],
    live: true,
    processedEmailId: current.processedEmailId ?? event.processedEmailId,
    subject: event.subject ?? current.subject,
    from: event.from ?? current.from,
    company: event.detectedCompany ?? current.company ?? companyFromSender(event.from ?? current.from),
    aiSummary: event.aiSummary ?? current.aiSummary,
  };

  const setStep = (key: StepKey, patch: Partial<PipelineStep>) => {
    next.steps[key] = { ...next.steps[key], timestamp: event.timestamp, ...patch };
  };
  const log = (text: string, tone: TimelineItem['tone']) => {
    const id = `${event.stage}-${event.toolName ?? ''}-${event.timestamp}`;
    if (!next.timeline.some((item) => item.id === id)) {
      next.timeline.push({ id, timestamp: event.timestamp, text, tone });
    }
  };

  backfillEarlierSteps(next, event);

  // Un evento no final sobre un proceso terminado = reintento: vuelve a quedar en curso.
  if (current.finalStatus && !FINAL_STAGES.includes(event.stage)) {
    next.finalStatus = undefined;
    next.elapsedMs = undefined;
    next.steps.done = { key: 'done', status: 'PENDING' };
  }

  switch (event.stage) {
    case 'EMAIL_DETECTED':
      setStep('gmail', { status: 'SUCCESS', detail: 'Nuevo correo' });
      log('Correo detectado', 'success');
      break;

    case 'EMAIL_CLAIMED':
      if (next.steps.gmail.status !== 'SUCCESS') {
        setStep('gmail', { status: 'SUCCESS', detail: 'Nuevo correo' });
      }
      break;

    case 'AI_ANALYSIS_STARTED':
      setStep('gemini', { status: 'PROCESSING', detail: 'Analizando correo', error: undefined });
      log('Gemini comenzó el análisis', 'processing');
      break;

    case 'AI_ANALYSIS_COMPLETED':
      if (event.status === 'FAILED') {
        setStep('gemini', { status: 'FAILED', detail: undefined, error: event.message ?? 'Falló el análisis con Gemini' });
        log('Falló el análisis con Gemini', 'error');
      } else {
        const tools = numberMeta(event, 'toolsDetected') ?? 0;
        next.toolsDetected = tools;
        const text = tools === 0 ? 'Sin acciones' : `${tools} ${tools === 1 ? 'acción detectada' : 'acciones detectadas'}`;
        setStep('gemini', { status: 'SUCCESS', detail: text, error: undefined });
        log(tools === 0 ? 'Gemini no detectó acciones' : `Gemini detectó ${tools} ${tools === 1 ? 'acción' : 'acciones'}`, 'success');
      }
      break;

    case 'TOOL_STARTED': {
      const key = toolStep(event.toolName);
      if (key) {
        setStep(key, {
          status: 'PROCESSING',
          detail: TOOL_WORKING_TEXT[key as 'crm' | 'jira' | 'calendar'],
          error: undefined,
          attempt: numberMeta(event, 'attempt'),
          maxAttempts: numberMeta(event, 'maxAttempts'),
        });
      }
      break;
    }

    case 'TOOL_COMPLETED': {
      const key = toolStep(event.toolName);
      if (key === 'crm') {
        next.crm = crmFrom(event.metadata, event.externalId ? Number(event.externalId) : undefined);
        setStep('crm', { status: 'SUCCESS', detail: next.crm ? crmDetail(next.crm) : 'Contacto registrado', error: undefined });
        log(
          next.crm?.created === false ? `Contacto CRM actualizado: ${next.crm?.name ?? ''}`.trim() : `Contacto CRM creado: ${next.crm?.name ?? ''}`.trim(),
          'success',
        );
      } else if (key === 'jira') {
        next.jira = { key: event.externalId ?? 'Ticket', url: event.externalUrl };
        setStep('jira', { status: 'SUCCESS', detail: event.externalId, error: undefined });
        log(`Ticket ${event.externalId ?? ''} creado`.replace('  ', ' '), 'success');
      } else if (key === 'calendar') {
        next.meeting = { start: stringMeta(event, 'start'), end: stringMeta(event, 'end'), url: event.externalUrl };
        setStep('calendar', { status: 'SUCCESS', detail: meetingText(next.meeting) ?? 'Evento creado', error: undefined });
        log('Reunión creada', 'success');
      }
      break;
    }

    case 'TOOL_FAILED': {
      const key = toolStep(event.toolName);
      if (key) {
        setStep(key, {
          status: 'FAILED',
          detail: undefined,
          error: event.message ?? `No se pudo completar ${STEP_LABELS[key]}.`,
          attempt: numberMeta(event, 'attempt'),
          maxAttempts: numberMeta(event, 'maxAttempts'),
        });
        log(event.message ?? `${STEP_LABELS[key]} falló`, 'error');
      }
      break;
    }

    case 'TOOL_SKIPPED': {
      const key = toolStep(event.toolName);
      if (key) {
        setStep(key, { status: 'SKIPPED', detail: 'Omitido' });
      }
      break;
    }

    case 'REPLY_DRAFT_STARTED':
      setStep('reply', { status: 'PROCESSING', detail: 'Redactando respuesta', error: undefined });
      log('Gemini está redactando la respuesta sugerida', 'processing');
      break;
    case 'REPLY_DRAFT_COMPLETED':
      next.reply = replyFromEvent(event, 'DRAFT') ?? next.reply;
      setStep('reply', { status: 'SUCCESS', detail: 'Por revisar', error: undefined });
      log('Respuesta sugerida lista para revisar', 'success');
      break;
    case 'REPLY_DRAFT_FAILED':
      next.reply = replyFromEvent(event, 'FAILED') ?? next.reply;
      setStep('reply', { status: 'FAILED', detail: undefined, error: event.error ?? event.message ?? 'No se pudo redactar la respuesta.' });
      log('No se pudo redactar la respuesta sugerida', 'error');
      break;
    case 'REPLY_DRAFT_SKIPPED':
      setStep('reply', { status: 'SKIPPED', detail: event.message ?? 'No requiere respuesta' });
      break;

    case 'MARK_READ_STARTED':
      setStep('markRead', { status: 'PROCESSING', detail: 'Quitando UNREAD', error: undefined });
      break;
    case 'MARK_READ_COMPLETED':
      setStep('markRead', { status: 'SUCCESS', detail: 'Marcado como leído', error: undefined });
      log('Correo marcado como leído', 'success');
      break;
    case 'MARK_READ_FAILED':
      setStep('markRead', { status: 'FAILED', detail: undefined, error: event.message ?? 'No se pudo marcar como leído.' });
      log('No se pudo marcar el correo como leído', 'error');
      break;

    case 'PROCESS_COMPLETED':
    case 'PROCESS_IGNORED':
      next.finalStatus = event.stage === 'PROCESS_IGNORED' ? 'IGNORED' : 'PROCESSED';
      next.elapsedMs = event.elapsedMs;
      skipPendingTools(next, event.timestamp);
      if (next.steps.reply.status === 'PENDING') {
        setStep('reply', { status: 'SKIPPED', detail: next.finalStatus === 'IGNORED' ? 'No requiere respuesta' : 'No generada' });
      }
      setStep('done', { status: 'SUCCESS', detail: next.finalStatus === 'IGNORED' ? 'Sin acciones' : 'Todo correcto' });
      log(next.finalStatus === 'IGNORED' ? 'Correo sin acciones: ignorado' : 'Procesamiento completado', 'success');
      break;

    case 'PROCESS_PARTIAL':
    case 'PROCESS_FAILED':
      next.finalStatus = event.stage === 'PROCESS_PARTIAL' ? 'PARTIAL' : 'FAILED';
      next.elapsedMs = event.elapsedMs;
      if (next.steps.markRead.status === 'PENDING') {
        setStep('markRead', { status: 'SKIPPED', detail: 'Sigue sin leer hasta el reintento' });
      }
      setStep('done', { status: 'FAILED', detail: next.finalStatus === 'PARTIAL' ? 'Parcial · se reintentará' : 'Fallido' });
      log(next.finalStatus === 'PARTIAL' ? 'Procesamiento parcial: se reintentará' : 'Procesamiento fallido', 'error');
      break;
  }
  return next;
}

const AFTER_ANALYSIS: readonly AutomationEvent['stage'][] = [
  'TOOL_STARTED',
  'TOOL_COMPLETED',
  'TOOL_FAILED',
  'TOOL_SKIPPED',
  'REPLY_DRAFT_STARTED',
  'REPLY_DRAFT_COMPLETED',
  'REPLY_DRAFT_FAILED',
  'REPLY_DRAFT_SKIPPED',
  'MARK_READ_STARTED',
  'MARK_READ_COMPLETED',
  'MARK_READ_FAILED',
  'PROCESS_COMPLETED',
  'PROCESS_PARTIAL',
  'PROCESS_IGNORED',
];

/**
 * Si el dashboard empezó a seguir el correo a mitad de camino (p. ej. se abrió después de EMAIL_DETECTED),
 * cualquier evento posterior implica que las etapas previas ya ocurrieron: no se dejan en "Pendiente".
 */
function backfillEarlierSteps(process: EmailProcess, event: AutomationEvent): void {
  if (event.stage !== 'EMAIL_DETECTED' && process.steps.gmail.status === 'PENDING') {
    process.steps.gmail = { key: 'gmail', status: 'SUCCESS', timestamp: process.startedAt, detail: 'Correo detectado' };
    if (!process.timeline.some((item) => item.text === 'Correo detectado')) {
      process.timeline.unshift({ id: `backfill-detected-${process.gmailMessageId}`, timestamp: process.startedAt, text: 'Correo detectado', tone: 'success' });
    }
  }
  if (AFTER_ANALYSIS.includes(event.stage) && (process.steps.gemini.status === 'PENDING' || process.steps.gemini.status === 'PROCESSING')) {
    process.steps.gemini = { ...process.steps.gemini, status: 'SUCCESS', detail: process.steps.gemini.detail ?? 'Análisis completado' };
  }
}

/** Al terminar, Jira/Calendar que Gemini no pidió quedan como "no solicitado". */
function skipPendingTools(process: EmailProcess, timestamp: string): void {
  for (const key of ['crm', 'jira', 'calendar'] as const) {
    if (process.steps[key].status === 'PENDING') {
      process.steps[key] = { key, status: 'SKIPPED', detail: 'No solicitado', timestamp };
    }
  }
}

function actionStepStatus(action?: EmailAction): StepStatus | null {
  return action ? action.status : null;
}

/** Reconstruye el pipeline desde BD (sin timestamps por etapa más allá de los que guarda cada acción). */
export function processFromDetail(detail: ProcessedEmailDetail): EmailProcess {
  const { email, actions, reply } = detail;
  const steps = emptySteps();
  const timeline: TimelineItem[] = [];
  const finished = email.status !== 'PROCESSING';
  const crmAction = actions.find((a) => a.toolName === CRM_TOOL);
  const jiraAction = actions.find((a) => a.toolName === JIRA_TOOL);
  const calendarAction = actions.find((a) => a.toolName === CALENDAR_TOOL);
  const analyzed = !!email.aiSummary || actions.length > 0 || email.status === 'IGNORED';

  steps.gmail = { key: 'gmail', status: 'SUCCESS', timestamp: email.createdAt, detail: 'Correo detectado' };
  timeline.push({ id: `detected-${email.id}`, timestamp: email.createdAt, text: 'Correo detectado', tone: 'success' });

  if (analyzed) {
    const tools = actions.length;
    steps.gemini = {
      key: 'gemini',
      status: 'SUCCESS',
      detail: tools === 0 ? 'Sin acciones' : `${tools} ${tools === 1 ? 'acción detectada' : 'acciones detectadas'}`,
    };
  } else if (email.status === 'FAILED') {
    steps.gemini = { key: 'gemini', status: 'FAILED', error: email.errorMessage ?? 'Falló el análisis con Gemini' };
  } else if (email.status === 'PROCESSING') {
    steps.gemini = { key: 'gemini', status: 'PROCESSING', detail: 'Analizando correo' };
  }

  const meeting: MeetingResult | undefined =
    email.meetingStart || calendarAction?.externalUrl
      ? { start: email.meetingStart, end: email.meetingEnd, url: calendarAction?.externalUrl }
      : undefined;
  const crm = crmAction?.status === 'SUCCESS' ? crmFrom(parseJson(crmAction.responsePayload), Number(crmAction.externalId)) : undefined;
  const toolEntries: [StepKey, EmailAction | undefined][] = [
    ['crm', crmAction],
    ['jira', jiraAction],
    ['calendar', calendarAction],
  ];
  for (const [key, action] of toolEntries) {
    const status = actionStepStatus(action);
    if (!action || !status) {
      steps[key] = { key, status: finished && analyzed ? 'SKIPPED' : 'PENDING', detail: finished && analyzed ? 'No solicitado' : undefined };
      continue;
    }
    const success = status === 'SUCCESS';
    steps[key] = {
      key,
      status,
      timestamp: action.updatedAt,
      detail: success
        ? key === 'crm'
          ? crm
            ? crmDetail(crm)
            : 'Contacto registrado'
          : key === 'jira'
            ? action.externalId
            : meetingText(meeting) ?? 'Evento creado'
        : status === 'SKIPPED'
          ? action.errorMessage ?? 'Omitido'
          : undefined,
      error: status === 'FAILED' ? action.errorMessage ?? `No se pudo completar ${STEP_LABELS[key]}.` : undefined,
      attempt: action.attemptCount || undefined,
      nextRetryAt: status === 'FAILED' ? email.nextRetryAt : undefined,
    };
    if (success) {
      timeline.push({
        id: `${key}-${action.id}`,
        timestamp: action.updatedAt,
        text: key === 'crm' ? `Contacto CRM registrado: ${crm?.name ?? ''}`.trim() : key === 'jira' ? `Ticket ${action.externalId} creado` : 'Reunión creada',
        tone: 'success',
      });
    } else if (status === 'FAILED') {
      timeline.push({ id: `${key}-${action.id}`, timestamp: action.updatedAt, text: `${STEP_LABELS[key]} falló`, tone: 'error' });
    }
  }

  if (reply) {
    steps.reply = replyStep(reply);
    if (reply.status !== 'FAILED' && reply.createdAt) {
      timeline.push({ id: `reply-${reply.id}`, timestamp: reply.createdAt, text: 'Respuesta sugerida lista para revisar', tone: 'success' });
    }
    if (reply.status === 'SENT' && reply.sentAt) {
      timeline.push({ id: `reply-sent-${reply.id}`, timestamp: reply.sentAt, text: `Respuesta enviada a ${reply.toAddress}`, tone: 'success' });
    }
  } else if (email.status === 'PROCESSED' || email.status === 'IGNORED') {
    steps.reply = { key: 'reply', status: 'SKIPPED', detail: email.status === 'IGNORED' ? 'No requiere respuesta' : 'No generada' };
  }

  if (email.gmailMarkedRead) {
    steps.markRead = { key: 'markRead', status: 'SUCCESS', timestamp: email.processedAt, detail: 'Marcado como leído' };
  } else if (email.status === 'PROCESSED' || email.status === 'IGNORED') {
    steps.markRead = { key: 'markRead', status: 'FAILED', error: email.errorMessage ?? 'Pendiente de marcar como leído', nextRetryAt: email.nextRetryAt };
  } else if (email.status === 'PARTIAL' || email.status === 'FAILED') {
    steps.markRead = { key: 'markRead', status: 'SKIPPED', detail: 'Sigue sin leer hasta el reintento' };
  }

  if (email.status === 'PROCESSED' || email.status === 'IGNORED') {
    steps.done = {
      key: 'done',
      status: 'SUCCESS',
      timestamp: email.processedAt,
      detail: email.status === 'IGNORED' ? 'Sin acciones' : 'Todo correcto',
    };
    if (email.processedAt) {
      timeline.push({ id: `done-${email.id}`, timestamp: email.processedAt, text: 'Procesamiento completado', tone: 'success' });
    }
  } else if (email.status === 'PARTIAL' || email.status === 'FAILED') {
    steps.done = {
      key: 'done',
      status: 'FAILED',
      timestamp: email.updatedAt,
      detail: email.status === 'PARTIAL' ? 'Parcial · se reintentará' : 'Fallido',
      error: email.errorMessage,
      attempt: email.attemptCount,
      nextRetryAt: email.nextRetryAt,
    };
  } else {
    steps.done = { key: 'done', status: 'PROCESSING' };
  }

  timeline.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return {
    gmailMessageId: email.gmailMessageId,
    processedEmailId: email.id,
    subject: email.subject,
    from: email.fromAddress,
    company: email.detectedCompany ?? companyFromSender(email.fromAddress),
    aiSummary: email.aiSummary,
    toolsDetected: actions.length,
    receivedAt: email.receivedAt,
    startedAt: email.createdAt,
    elapsedMs: email.elapsedMs,
    finalStatus: finished ? email.status : undefined,
    steps,
    timeline,
    crm,
    jira: jiraAction?.status === 'SUCCESS' && jiraAction.externalId ? { key: jiraAction.externalId, url: jiraAction.externalUrl } : undefined,
    meeting: calendarAction?.status === 'SUCCESS' ? meeting : undefined,
    reply,
    live: false,
  };
}
