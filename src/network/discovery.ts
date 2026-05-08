import { Bonjour } from 'bonjour-service';

export interface DiscoveredDevice {
  name: string;
  ip: string;
  port: number;
}

export class DiscoveryManager {
  private bonjour: Bonjour;
  private readonly deviceId: string;
  private readonly deviceName: string;
  private readonly port: number;
  private devices: Map<string, DiscoveredDevice> = new Map();

  constructor(deviceId: string, deviceName: string, port: number) {
    this.bonjour = new Bonjour();
    this.deviceId = deviceId;
    this.deviceName = deviceName;
    this.port = port;
  }

  start() {
    // Broadcast our service
    this.bonjour.publish({
      name: this.deviceName,
      type: 'clipsync',
      port: this.port,
      txt: { id: this.deviceId }
    });

    // Find other services
    const browser = this.bonjour.find({ type: 'clipsync' });
    
    browser.on('up', (service) => {
      if (service.txt && service.txt.id !== this.deviceId) {
        const ip = service.addresses?.find((a: string) => a.includes('.')) || service.addresses?.[0];
        if (ip) {
          this.devices.set(service.txt.id, {
            name: service.name,
            ip,
            port: service.port
          });
        }
      }
    });

    browser.on('down', (service) => {
      if (service.txt && service.txt.id) {
        this.devices.delete(service.txt.id);
      }
    });
  }

  getDiscoveredDevices(): DiscoveredDevice[] {
    return Array.from(this.devices.values());
  }

  stop() {
    this.bonjour.unpublishAll();
    this.bonjour.destroy();
  }
}
