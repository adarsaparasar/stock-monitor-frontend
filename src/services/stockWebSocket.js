import { Client } from '@stomp/stompjs';



const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'https://stock-monitor-backend-tplo.onrender.com';

const WS_URL =
  API_BASE_URL.replace(/\/+$/, '').replace(/^https?:\/\//, 'wss://').replace(/^wss?:\/\//, 'wss://')
  + '/ws-stocks';


export function connectToStockUpdates(onStockUpdate) {
  const client = new Client({
    brokerURL: WS_URL,
    reconnectDelay: 5000,

    debug: (message) => {
      console.log('[STOMP DEBUG]', message);
    },

    onConnect: () => {
      console.log('Connected to stock WebSocket');

      client.subscribe('/topic/stocks', (message) => {
        console.log('[STOMP MESSAGE]', message.body);

        try {
          const stock = JSON.parse(message.body);
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