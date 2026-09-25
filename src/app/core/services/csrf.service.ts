import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { API_BASE_URL } from '@core/config/app-config';

interface CsrfToken {
  headerName: string;
  token: string;
}

/** Token CSRF de Spring Security para las operaciones protegidas (logout, enviar respuestas…). */
@Injectable({ providedIn: 'root' })
export class CsrfService {
  private readonly http = inject(HttpClient);

  headers(): Observable<Record<string, string>> {
    return this.http
      .get<CsrfToken>(`${API_BASE_URL}/api/auth/csrf`)
      .pipe(map((csrf) => ({ [csrf.headerName]: csrf.token })));
  }
}
