/** CRM propio (GET /api/crm/prospects). Espejo de ProspectResponse.java. */
export type ProspectStatus = 'NEW' | 'CONTACTED' | 'INTERESTED' | 'MEETING_SCHEDULED' | 'CLIENT' | 'DISCARDED';

/** De dónde salió un dato: real (GEMINI/MANUAL) o inferido (FROM_HEADER/EMAIL_ADDRESS/EMAIL_DOMAIN). */
export type ProspectDataSource = 'GEMINI' | 'FROM_HEADER' | 'EMAIL_ADDRESS' | 'EMAIL_DOMAIN' | 'MANUAL';

export type ProspectField = 'name' | 'company' | 'phone';

export interface Prospect {
  id: number;
  email: string;
  name?: string;
  nameSource?: ProspectDataSource;
  company?: string;
  companySource?: ProspectDataSource;
  phone?: string;
  status: ProspectStatus;
  notes?: string;
  lastSubject?: string;
  lastGmailMessageId?: string;
  lastContactAt?: string;
  interactionCount: number;
  /** Datos que el correo no incluyó. */
  missingFields: ProspectField[];
  /** Datos deducidos del From o del dominio (no escritos por el contacto). */
  inferredFields: ProspectField[];
  createdAt: string;
  updatedAt: string;
}

export interface ProspectInteraction {
  id: number;
  gmailMessageId?: string;
  subject?: string;
  statusBefore?: ProspectStatus;
  statusAfter: ProspectStatus;
  notes?: string;
  source: ProspectDataSource;
  createdAt: string;
}

export interface ProspectDetail {
  prospect: Prospect;
  interactions: ProspectInteraction[];
}

export const PROSPECT_FIELD_LABELS: Record<ProspectField, string> = {
  name: 'nombre',
  company: 'empresa',
  phone: 'teléfono',
};
