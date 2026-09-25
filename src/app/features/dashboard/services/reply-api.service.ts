import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, switchMap } from 'rxjs';

import { API_BASE_URL } from '@core/config/app-config';
import { CsrfService } from '@core/services/csrf.service';

import { EmailReply } from '../models/email-reply.model';

/** Respuestas sugeridas: el backend exige sesión y token CSRF porque envía correos en nombre del usuario. */
@Injectable({ providedIn: 'root' })
export class ReplyApiService {
  private readonly http = inject(HttpClient);
  private readonly csrf = inject(CsrfService);
  private readonly baseUrl = `${API_BASE_URL}/api/replies`;

  send(id: number, body: string): Observable<EmailReply> {
    return this.post(`${this.baseUrl}/${id}/send`, { body });
  }

  regenerate(id: number): Observable<EmailReply> {
    return this.post(`${this.baseUrl}/${id}/regenerate`, null);
  }

  discard(id: number): Observable<EmailReply> {
    return this.post(`${this.baseUrl}/${id}/discard`, null);
  }

  private post(url: string, body: unknown): Observable<EmailReply> {
    return this.csrf.headers().pipe(switchMap((headers) => this.http.post<EmailReply>(url, body, { headers })));
  }
}
