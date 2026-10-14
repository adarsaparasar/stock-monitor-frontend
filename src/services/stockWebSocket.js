
import { Client } from '@stomp/stompjs';

export function connectToStockUpdates(onStockUpdate) {
  const client = new Client({
    brokerURL: 'ws://localhost:8080/ws-stocks',
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
    }
  });

  client.activate();

  return () => client.deactivate();
}
