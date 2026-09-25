import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '@core/config/app-config';

import { AutomationStatus, IntegrationsStatus } from '../models/automation-status.model';
import { ProcessedEmail, ProcessedEmailDetail } from '../models/processed-email.model';

/** Endpoints REST de monitoreo de la automatización (solo lectura). */
@Injectable({ providedIn: 'root' })
export class AutomationApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/api/automation`;

  getStatus(): Observable<AutomationStatus> {
    return this.http.get<AutomationStatus>(`${this.baseUrl}/status`);
  }

  getIntegrations(): Observable<IntegrationsStatus> {
    return this.http.get<IntegrationsStatus>(`${this.baseUrl}/integrations`);
  }

  getEmails(limit = 50): Observable<ProcessedEmail[]> {
    return this.http.get<ProcessedEmail[]>(`${this.baseUrl}/emails`, { params: { limit } });
  }

  getEmailDetail(id: number): Observable<ProcessedEmailDetail> {
    return this.http.get<ProcessedEmailDetail>(`${this.baseUrl}/emails/${id}`);
  }
}
