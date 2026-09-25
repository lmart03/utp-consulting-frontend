import { AutomationEvent } from '../models/automation-event.model';
import { ProcessedEmailDetail } from '../models/processed-email.model';
import { applyEvent, createProcess, processFromDetail } from './pipeline-builder';

const base = { gmailMessageId: 'g1', subject: 'Reunión NovaTech', from: 'Ana <ana@novatech.com>' };
let clock = 0;
function event(partial: Partial<AutomationEvent> & Pick<AutomationEvent, 'stage' | 'status'>): AutomationEvent {
  clock += 1000;
  return { ...base, timestamp: new Date(Date.UTC(2026, 8, 25, 18, 0, 0) + clock).toISOString(), ...partial };
}

function run(events: AutomationEvent[]) {
  return events.reduce((process, e) => applyEvent(process, e), createProcess(events[0]));
}

describe('pipeline-builder', () => {
  it('sigue el flujo completo en vivo: Gmail → Gemini → Jira → Calendar → leído → completado', () => {
    const process = run([
      event({ stage: 'EMAIL_DETECTED', status: 'SUCCESS' }),
      event({ stage: 'EMAIL_CLAIMED', status: 'SUCCESS', processedEmailId: 7 }),
      event({ stage: 'AI_ANALYSIS_STARTED', status: 'PROCESSING', processedEmailId: 7 }),
      event({
        stage: 'AI_ANALYSIS_COMPLETED',
        status: 'SUCCESS',
        processedEmailId: 7,
        aiSummary: 'NovaTech pide reunión.',
        detectedCompany: 'NovaTech',
        metadata: { toolsDetected: 3 },
      }),
      event({ stage: 'TOOL_SKIPPED', status: 'SKIPPED', toolName: 'actualizar_contacto_crm' }),
      event({ stage: 'TOOL_STARTED', status: 'PROCESSING', toolName: 'crear_ticket_jira', metadata: { attempt: 1, maxAttempts: 4 } }),
      event({ stage: 'TOOL_COMPLETED', status: 'SUCCESS', toolName: 'crear_ticket_jira', externalId: 'SCRUM-14', externalUrl: 'https://jira/SCRUM-14' }),
      event({ stage: 'TOOL_STARTED', status: 'PROCESSING', toolName: 'agendar_reunion_google_calendar' }),
      event({
        stage: 'TOOL_COMPLETED',
        status: 'SUCCESS',
        toolName: 'agendar_reunion_google_calendar',
        externalUrl: 'https://calendar/evt',
        metadata: { start: '2026-09-26T15:00:00-05:00', end: '2026-09-26T16:00:00-05:00' },
      }),
      event({ stage: 'MARK_READ_STARTED', status: 'PROCESSING' }),
      event({ stage: 'MARK_READ_COMPLETED', status: 'SUCCESS' }),
      event({ stage: 'PROCESS_COMPLETED', status: 'SUCCESS', elapsedMs: 6200 }),
    ]);

    expect(process.processedEmailId).toBe(7);
    expect(process.company).toBe('NovaTech');
    expect(process.aiSummary).toBe('NovaTech pide reunión.');
    expect(Object.values(process.steps).map((s) => s.status)).toEqual(['SUCCESS', 'SUCCESS', 'SUCCESS', 'SUCCESS', 'SUCCESS', 'SUCCESS']);
    expect(process.steps.gemini.detail).toBe('3 acciones detectadas');
    expect(process.jira).toEqual({ key: 'SCRUM-14', url: 'https://jira/SCRUM-14' });
    expect(process.meeting?.start).toBe('2026-09-26T15:00:00-05:00');
    expect(process.steps.calendar.detail).toContain('15:00 – 16:00');
    expect(process.finalStatus).toBe('PROCESSED');
    expect(process.elapsedMs).toBe(6200);
    expect(process.timeline.map((t) => t.text)).toEqual([
      'Correo detectado',
      'Gemini comenzó el análisis',
      'Gemini detectó 3 acciones',
      'CRM omitido (no implementado aún)',
      'Ticket SCRUM-14 creado',
      'Reunión creada',
      'Correo marcado como leído',
      'Procesamiento completado',
    ]);
  });

  it('marca la etapa en proceso mientras llega el siguiente evento', () => {
    const process = run([
      event({ stage: 'EMAIL_DETECTED', status: 'SUCCESS' }),
      event({ stage: 'AI_ANALYSIS_STARTED', status: 'PROCESSING' }),
    ]);

    expect(process.steps.gmail.status).toBe('SUCCESS');
    expect(process.steps.gemini.status).toBe('PROCESSING');
    expect(process.steps.jira.status).toBe('PENDING');
    expect(process.finalStatus).toBeUndefined();
  });

  it('fallo parcial: Calendar FAILED con intento, no marca leído y el proceso queda PARTIAL', () => {
    const process = run([
      event({ stage: 'EMAIL_DETECTED', status: 'SUCCESS' }),
      event({ stage: 'AI_ANALYSIS_COMPLETED', status: 'SUCCESS', metadata: { toolsDetected: 2 } }),
      event({ stage: 'TOOL_COMPLETED', status: 'SUCCESS', toolName: 'crear_ticket_jira', externalId: 'SCRUM-15' }),
      event({
        stage: 'TOOL_FAILED',
        status: 'FAILED',
        toolName: 'agendar_reunion_google_calendar',
        message: 'No se pudo crear el evento.',
        metadata: { attempt: 1, maxAttempts: 3 },
      }),
      event({ stage: 'PROCESS_PARTIAL', status: 'FAILED', elapsedMs: 4000 }),
    ]);

    expect(process.steps.calendar).toMatchObject({ status: 'FAILED', error: 'No se pudo crear el evento.', attempt: 1, maxAttempts: 3 });
    expect(process.steps.markRead.status).toBe('SKIPPED');
    expect(process.steps.done.status).toBe('FAILED');
    expect(process.finalStatus).toBe('PARTIAL');
  });

  it('correo sin acciones: Jira y Calendar quedan omitidos y el proceso IGNORED', () => {
    const process = run([
      event({ stage: 'EMAIL_DETECTED', status: 'SUCCESS' }),
      event({ stage: 'AI_ANALYSIS_COMPLETED', status: 'SUCCESS', metadata: { toolsDetected: 0 } }),
      event({ stage: 'MARK_READ_COMPLETED', status: 'SUCCESS' }),
      event({ stage: 'PROCESS_IGNORED', status: 'SUCCESS', elapsedMs: 1500 }),
    ]);

    expect(process.steps.jira.status).toBe('SKIPPED');
    expect(process.steps.calendar.status).toBe('SKIPPED');
    expect(process.finalStatus).toBe('IGNORED');
  });

  it('si el seguimiento empieza a mitad del proceso, Gmail y Gemini no quedan pendientes', () => {
    const process = run([
      event({ stage: 'AI_ANALYSIS_STARTED', status: 'PROCESSING' }),
      event({ stage: 'TOOL_STARTED', status: 'PROCESSING', toolName: 'crear_ticket_jira' }),
    ]);

    expect(process.steps.gmail.status).toBe('SUCCESS');
    expect(process.steps.gemini.status).toBe('SUCCESS');
    expect(process.steps.jira.status).toBe('PROCESSING');
    expect(process.timeline[0].text).toBe('Correo detectado');
  });

  it('un reintento sobre un proceso terminado lo vuelve a poner en curso', () => {
    const partial = run([
      event({ stage: 'EMAIL_DETECTED', status: 'SUCCESS' }),
      event({ stage: 'PROCESS_PARTIAL', status: 'FAILED' }),
    ]);
    const retry = applyEvent(partial, event({ stage: 'TOOL_STARTED', status: 'PROCESSING', toolName: 'agendar_reunion_google_calendar' }));

    expect(retry.finalStatus).toBeUndefined();
    expect(retry.steps.done.status).toBe('PENDING');
    expect(retry.steps.calendar.status).toBe('PROCESSING');
  });

  it('reconstruye el pipeline desde el detalle REST', () => {
    const detail: ProcessedEmailDetail = {
      email: {
        id: 1,
        gmailMessageId: 'g1',
        fromAddress: 'Ana <ana@novatech.com>',
        subject: 'Reunión NovaTech',
        status: 'PROCESSED',
        attemptCount: 1,
        gmailMarkedRead: true,
        aiSummary: 'Resumen',
        processedAt: '2026-09-25T18:00:09Z',
        elapsedMs: 8900,
        jiraIssueKey: 'SCRUM-6',
        meetingStart: '2026-09-26T15:00:00-05:00',
        meetingEnd: '2026-09-26T16:00:00-05:00',
        createdAt: '2026-09-25T18:00:00Z',
        updatedAt: '2026-09-25T18:00:09Z',
      },
      actions: [
        { id: 1, toolName: 'crear_ticket_jira', status: 'SUCCESS', externalId: 'SCRUM-6', externalUrl: 'https://jira/SCRUM-6', attemptCount: 1, createdAt: '2026-09-25T18:00:03Z', updatedAt: '2026-09-25T18:00:04Z' },
        { id: 2, toolName: 'agendar_reunion_google_calendar', status: 'SUCCESS', externalId: 'evt', externalUrl: 'https://cal/evt', attemptCount: 1, createdAt: '2026-09-25T18:00:05Z', updatedAt: '2026-09-25T18:00:06Z' },
        { id: 3, toolName: 'actualizar_contacto_crm', status: 'SKIPPED', attemptCount: 0, createdAt: '2026-09-25T18:00:03Z', updatedAt: '2026-09-25T18:00:03Z' },
      ],
    };

    const process = processFromDetail(detail);

    expect(Object.values(process.steps).every((s) => s.status === 'SUCCESS')).toBe(true);
    expect(process.company).toBe('Novatech');
    expect(process.jira).toEqual({ key: 'SCRUM-6', url: 'https://jira/SCRUM-6' });
    expect(process.meeting?.url).toBe('https://cal/evt');
    expect(process.live).toBe(false);
  });
});
