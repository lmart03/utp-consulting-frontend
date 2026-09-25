/** Respuesta de GET /api/auth/me (datos no sensibles de la cuenta Google). */
export interface AuthUser {
  authenticated: boolean;
  name: string | null;
  email: string | null;
  refreshTokenAvailable: boolean;
}
