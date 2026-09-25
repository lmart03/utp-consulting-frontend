import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '@core/config/app-config';

import { Prospect, ProspectDetail } from '../models/prospect.model';

/** CRM propio (solo lectura desde el dashboard). */
@Injectable({ providedIn: 'root' })
export class CrmApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/api/crm`;

  getProspects(search?: string, limit = 50): Observable<Prospect[]> {
    const params: Record<string, string | number> = { limit };
    if (search?.trim()) {
      params['search'] = search.trim();
    }
    return this.http.get<Prospect[]>(`${this.baseUrl}/prospects`, { params });
  }

  getProspect(id: number): Observable<ProspectDetail> {
    return this.http.get<ProspectDetail>(`${this.baseUrl}/prospects/${id}`);
  }
}
