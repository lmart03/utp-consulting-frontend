import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, switchMap, tap } from 'rxjs';

import { API_BASE_URL, GOOGLE_LOGIN_URL } from '@core/config/app-config';
import { AuthUser } from '@shared/models/auth-user.model';

interface CsrfToken {
  headerName: string;
  token: string;
}

/** Sesión Google del usuario (global). El login/logout real lo gestiona Spring Security. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly _user = signal<AuthUser | null>(null);
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  /** Consulta la sesión actual; null si no hay sesión (401). */
  loadCurrentUser(): Observable<AuthUser | null> {
    return this.http.get<AuthUser>(`${API_BASE_URL}/api/auth/me`).pipe(
      tap((user) => this._user.set(user)),
      catchError(() => {
        this._user.set(null);
        return of(null);
      }),
    );
  }

  /** Redirige al flujo OAuth de Google en el backend. */
  loginWithGoogle(): void {
    window.location.href = GOOGLE_LOGIN_URL;
  }

  /** POST /logout de Spring Security (requiere token CSRF). Siempre limpia la sesión local. */
  logout(): Observable<void> {
    return this.http.get<CsrfToken>(`${API_BASE_URL}/api/auth/csrf`).pipe(
      switchMap((csrf) =>
        this.http.post(`${API_BASE_URL}/logout`, null, {
          headers: { [csrf.headerName]: csrf.token },
          responseType: 'text',
        }),
      ),
      map(() => undefined),
      catchError(() => of(undefined)),
      finalize(() => this._user.set(null)),
    );
  }
}
