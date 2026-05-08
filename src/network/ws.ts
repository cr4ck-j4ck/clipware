import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';

export interface SyncMessage {
  type: 'HELLO' | 'ACK' | 'CLIP_UPDATE' | 'REMOTE_TYPE';
  sourceId: string;
  payload?: string;
  timestamp: number;
}

export class NetworkManager {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private wsClient: WebSocket | null = null;
  private readonly deviceId: string;
  private readonly onMessage: (msg: SyncMessage) => void;
  public isConnected: boolean = false;
  public connectedPeer: string | null = null;
  private isServer = false;

  constructor(deviceId: string, onMessage: (msg: SyncMessage) => void) {
    this.deviceId = deviceId;
    this.onMessage = onMessage;
  }

  async init(port: number = 0): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = createServer();
      this.wss = new WebSocketServer({ server });
      
      this.wss.on('connection', (ws) => {
        this.clients.add(ws);
        this.setupHeartbeat(ws);
        
        ws.on('message', (data) => {
          try {
            const msg: SyncMessage = JSON.parse(data.toString());
            if (msg.type === 'HELLO' || msg.type === 'ACK') {
              this.isConnected = true;
              this.connectedPeer = msg.sourceId;
              if (msg.type === 'HELLO') {
                this.broadcast({ type: 'ACK', sourceId: this.deviceId, timestamp: Date.now() });
              }
            }
            this.onMessage(msg);
          } catch (e) {
            console.error('Failed to parse incoming message', e);
          }
        });

        ws.on('close', () => {
          this.clients.delete(ws);
        });
      });

      server.on('error', reject);
      
      server.listen(port, '0.0.0.0', () => {
        this.isServer = true;
        const addr = server.address();
        if (addr && typeof addr !== 'string') {
          resolve(addr.port);
        } else {
          reject(new Error("Failed to get port"));
        }
      });
    });
  }

  async connect(host: string, port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const ws = new WebSocket(`ws://${host}:${port}`);
      
      const timeout = setTimeout(() => {
        ws.terminate();
        resolve(false);
      }, 5000);

      ws.on('open', () => {
        clearTimeout(timeout);
        this.wsClient = ws;
        this.setupHeartbeat(ws);
        
        ws.on('message', (data) => {
          try {
            const msg: SyncMessage = JSON.parse(data.toString());
            if (msg.type === 'HELLO' || msg.type === 'ACK') {
              this.isConnected = true;
              this.connectedPeer = msg.sourceId;
            }
            this.onMessage(msg);
          } catch (e) {
            // Ignore parse errors
          }
        });
        
        ws.on('close', () => {
          this.wsClient = null;
          this.isConnected = false;
        });

        // Send HELLO
        this.broadcast({ type: 'HELLO', sourceId: this.deviceId, timestamp: Date.now() });
        this.isConnected = true;
        resolve(true);
      });

      ws.on('error', () => {
        clearTimeout(timeout);
        resolve(false);
      });
    });
  }

  broadcast(msg: SyncMessage) {
    const data = JSON.stringify(msg);
    
    // Broadcast to server clients
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
    
    // Send to connected server if we are a client
    if (this.wsClient && this.wsClient.readyState === WebSocket.OPEN) {
      this.wsClient.send(data);
    }
  }

  private setupHeartbeat(ws: WebSocket) {
    let isAlive = true;
    ws.on('pong', () => { isAlive = true; });
    
    const interval = setInterval(() => {
      if (isAlive === false) {
        clearInterval(interval);
        return ws.terminate();
      }
      isAlive = false;
      ws.ping();
    }, 30000);

    ws.on('close', () => clearInterval(interval));
  }
}
