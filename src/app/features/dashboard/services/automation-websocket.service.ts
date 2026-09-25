import { Injectable } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import { Observable } from 'rxjs';

import { AUTOMATION_TOPIC, WS_RECONNECT_DELAY_MS, automationWebSocketUrl } from '@core/config/app-config';

import { AutomationEvent } from '../models/automation-event.model';
import { LiveConnectionState } from '../models/automation-status.model';

export type AutomationSocketMessage =
  | { type: 'state'; state: LiveConnectionState }
  | { type: 'event'; event: AutomationEvent };

/**
 * Conexión STOMP (WebSocket nativo en /ws) al topic /topic/automation.
 * El Observable es frío: conecta al suscribirse y desconecta al desuscribirse. La reconexión es automática
 * (reconnectDelay) y se informa como mensajes 'state'. No guarda estado: el store lo mantiene.
 */
@Injectable({ providedIn: 'root' })
export class AutomationWebsocketService {
  connect(): Observable<AutomationSocketMessage> {
    return new Observable<AutomationSocketMessage>((subscriber) => {
      let wasConnected = false;
      const client = new Client({
        brokerURL: automationWebSocketUrl(),
        reconnectDelay: WS_RECONNECT_DELAY_MS,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
      });

      client.onConnect = () => {
        wasConnected = true;
        subscriber.next({ type: 'state', state: 'live' });
        client.subscribe(AUTOMATION_TOPIC, (message: IMessage) => {
          try {
            subscriber.next({ type: 'event', event: JSON.parse(message.body) as AutomationEvent });
          } catch {
            // Mensaje no JSON: se ignora sin romper el stream.
          }
        });
      };
      const onDisconnect = () => subscriber.next({ type: 'state', state: wasConnected ? 'reconnecting' : 'connecting' });
      client.onWebSocketClose = onDisconnect;
      client.onStompError = onDisconnect;

      subscriber.next({ type: 'state', state: 'connecting' });
      client.activate();
      return () => {
        void client.deactivate();
      };
    });
  }
}
