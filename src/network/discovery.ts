import * as dgram from 'dgram';
import os from 'os';

export interface DiscoveredDevice {
  name: string;
  ip: string;
  port: number;
  lastSeen: number;
}

const DISCOVERY_PORT = 41234;
const BROADCAST_INTERVAL_MS = 2000;

export class DiscoveryManager {
  private socket: dgram.Socket;
  private devices = new Map<string, DiscoveredDevice>();
  private broadcastInterval?: NodeJS.Timeout;
  private bound = false;

  constructor(
    private deviceId: string,
    private deviceName: string,
    private wsPort: number
  ) {
    this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    this.socket.on('listening', () => {
      this.socket.setBroadcast(true);
      try { this.socket.setMulticastLoopback(true); } catch (_) { /* ignored */ }
      this.bound = true;
    });

    this.socket.on('message', (msg, rinfo) => {
      try {
        const data = JSON.parse(msg.toString());
        const localIps = new Set<string>();
        for (const net of Object.values(os.networkInterfaces())) {
          for (const iface of (net || [])) {
            if (iface.family === 'IPv4') localIps.add(iface.address);
          }
        }

        if (localIps.has(rinfo.address)) {
          return; // Ignore messages from our own machine (prevents ghost processes)
        }

        if (data.deviceId && data.deviceId !== this.deviceId) {
          this.devices.set(data.deviceId, {
            name: data.deviceName || 'Unknown',
            ip: rinfo.address,
            port: data.wsPort,
            lastSeen: Date.now()
          });
        }
      } catch (_) { /* invalid payload */ }
    });

    this.socket.on('error', (err) => {
      console.warn(`[Discovery] UDP socket error: ${err.message}`);
    });
  }

  public start() {
    this.socket.bind(DISCOVERY_PORT, '0.0.0.0', () => {
      // socket bound
    });

    const startBroadcast = () => {
      if (!this.bound) {
        setTimeout(startBroadcast, 100);
        return;
      }
      this.sendBroadcast();
      this.broadcastInterval = setInterval(() => this.sendBroadcast(), BROADCAST_INTERVAL_MS);
    };
    startBroadcast();
  }

  private sendBroadcast() {
    const payload = JSON.stringify({
      deviceId: this.deviceId,
      deviceName: this.deviceName,
      wsPort: this.wsPort
    });

    const targets = new Set<string>(['255.255.255.255']);

    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const net of (interfaces[name] || [])) {
        if (net.family === 'IPv4' && !net.internal && net.netmask) {
          const ipParts = net.address.split('.');
          const maskParts = net.netmask.split('.');
          const bc = ipParts
            .map((p, i) => ((~parseInt(maskParts[i] ?? '255') & 255) | parseInt(p)))
            .join('.');
          targets.add(bc);
        }
      }
    }

    for (const addr of targets) {
      this.socket.send(payload, 0, payload.length, DISCOVERY_PORT, addr, () => {
        // ignore send errors
      });
    }
  }

  public getDiscoveredDevices(): DiscoveredDevice[] {
    const now = Date.now();
    for (const [id, device] of this.devices.entries()) {
      if (now - device.lastSeen > 10000) this.devices.delete(id);
    }
    return Array.from(this.devices.values());
  }

  public stop() {
    if (this.broadcastInterval) clearInterval(this.broadcastInterval);
    try { this.socket.close(); } catch (_) {}
  }
}
