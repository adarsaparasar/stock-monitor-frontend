
import { Client } from '@stomp/stompjs';


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const WS_URL = API_BASE_URL.replace(/^http/, 'ws') + '/ws-stocks';


export function connectToStockUpdates(onStockUpdate) {
  const client = new Client({
    brokerURL: WS_URL,
    reconnectDelay: 5000,

    onConnect: () => {
      console.log('Connected to stock WebSocket');

      client.subscribe('/topic/stocks', (message) => {
        try {
          const stock = JSON.parse(message.body);
          console.log('Received stock update:', stock);
          onStockUpdate(stock);
        } catch (error) {
          console.error('Invalid stock update:', error);
        }
      });
    },

    onStompError: (frame) => {
      console.error('STOMP error:', frame.headers.message);
    },

    onWebSocketError: (event) => {
      console.error('WebSocket error:', event);
    },
  });

  client.activate();

  return () => client.deactivate();
}
