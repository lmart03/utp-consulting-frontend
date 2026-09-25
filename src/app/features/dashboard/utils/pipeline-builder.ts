import { formatDay, formatTimeRange } from '@shared/utils/date-format';
import { companyFromSender } from '@shared/utils/email-address';

import { AutomationEvent, FINAL_STAGES } from '../models/automation-event.model';
import { CALENDAR_TOOL, CRM_TOOL, EmailAction, JIRA_TOOL } from '../models/email-action.model';
import {
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

function numberMeta(event: AutomationEvent, key: string): number | undefined {
  const value = event.metadata?.[key];
  return typeof value === 'number' ? value : undefined;
}

function stringMeta(event: AutomationEvent, key: string): string | undefined {
  const value = event.metadata?.[key];
  return typeof value === 'string' ? value : undefined;
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
          detail: key === 'jira' ? 'Creando ticket' : 'Agendando reunión',
          error: undefined,
          attempt: numberMeta(event, 'attempt'),
          maxAttempts: numberMeta(event, 'maxAttempts'),
        });
      }
      break;
    }

    case 'TOOL_COMPLETED': {
      const key = toolStep(event.toolName);
      if (key === 'jira') {
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
      } else if (event.toolName === CRM_TOOL) {
        log('CRM omitido (no implementado aún)', 'neutral');
      }
      break;
    }

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
  for (const key of ['jira', 'calendar'] as const) {
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
  const { email, actions } = detail;
  const steps = emptySteps();
  const timeline: TimelineItem[] = [];
  const finished = email.status !== 'PROCESSING';
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
  const toolEntries: [StepKey, EmailAction | undefined][] = [
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
      detail: success ? (key === 'jira' ? action.externalId : meetingText(meeting) ?? 'Evento creado') : undefined,
      error: status === 'FAILED' ? action.errorMessage ?? `No se pudo completar ${STEP_LABELS[key]}.` : undefined,
      attempt: action.attemptCount || undefined,
      nextRetryAt: status === 'FAILED' ? email.nextRetryAt : undefined,
    };
    if (success) {
      timeline.push({
        id: `${key}-${action.id}`,
        timestamp: action.updatedAt,
        text: key === 'jira' ? `Ticket ${action.externalId} creado` : 'Reunión creada',
        tone: 'success',
      });
    } else if (status === 'FAILED') {
      timeline.push({ id: `${key}-${action.id}`, timestamp: action.updatedAt, text: `${STEP_LABELS[key]} falló`, tone: 'error' });
    }
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
    jira: jiraAction?.status === 'SUCCESS' && jiraAction.externalId ? { key: jiraAction.externalId, url: jiraAction.externalUrl } : undefined,
    meeting: calendarAction?.status === 'SUCCESS' ? meeting : undefined,
    live: false,
  };
}
