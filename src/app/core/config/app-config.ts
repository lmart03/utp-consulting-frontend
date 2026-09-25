/**
 * Configuración de conexión con el backend UTP Assistant (Spring Boot).
 * En desarrollo se usa el proxy de Angular (proxy.conf.json): mismas URLs relativas, misma cookie de sesión
 * y sin problemas de CORS. Para apuntar a otro host basta con cambiar API_BASE_URL.
 */
export const API_BASE_URL = '';

/** Inicia el flujo OAuth 2.0 de Spring Security con Google. */
export const GOOGLE_LOGIN_URL = `${API_BASE_URL}/oauth2/authorization/google`;

/** Topic STOMP donde el backend publica cada etapa del procesamiento. */
export const AUTOMATION_TOPIC = '/topic/automation';

/** Espera entre intentos de reconexión del WebSocket. */
export const WS_RECONNECT_DELAY_MS = 3000;

/** Endpoint STOMP nativo (/ws) derivado del origen actual: ws:// en local, wss:// bajo https. */
export function automationWebSocketUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}/ws`;
}
