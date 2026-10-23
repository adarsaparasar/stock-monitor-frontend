import { Client } from '@stomp/stompjs';


const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'https://stock-monitor-backend-tplo.onrender.com';

const WS_URL = API_BASE_URL.replace(/\/+$/, '').replace(/^http/, 'ws')
  + '/ws-stocks';
  
export function connectToStockUpdates(onStockUpdate) {
  const client = new Client({
    brokerURL: WS_URL,
    reconnectDelay: 5000,
    // Keep the rest of your existing callbacks here.
  });

  client.activate();
  return () => client.deactivate();
}