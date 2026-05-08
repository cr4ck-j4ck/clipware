import { NetworkManager } from '../network/ws';

export class DesktopClipboard {
  private network: NetworkManager;
  private clipboardy: any;
  private lastKnownContent: string = '';
  private pollInterval: NodeJS.Timeout | null = null;
  private isPublisher: boolean = false;
  private isSubscriber: boolean = false;

  constructor(network: NetworkManager) {
    this.network = network;
  }

  async init(role: 'publisher' | 'subscriber' | 'bidirectional') {
    // Dynamically import clipboardy so it doesn't crash headless ARM devices
    this.clipboardy = (await import('clipboardy')).default;
    
    this.isPublisher = role === 'publisher' || role === 'bidirectional';
    this.isSubscriber = role === 'subscriber' || role === 'bidirectional';

    if (this.isPublisher) {
      this.lastKnownContent = await this.clipboardy.read();
      this.startPolling();
    }
  }

  private startPolling() {
    this.pollInterval = setInterval(async () => {
      try {
        const current = await this.clipboardy.read();
        if (current !== this.lastKnownContent && current.trim() !== '') {
          this.lastKnownContent = current;
          console.log(`[Clipboard] Local change detected. Broadcasting ${current.length} chars.`);
          this.network.broadcast({
            type: 'CLIP_UPDATE',
            sourceId: 'desktop', // Will be overridden by NetworkManager
            payload: current,
            timestamp: Date.now()
          });
        }
      } catch (err) {
        // Ignore read errors
      }
    }, 500);
  }

  async handleRemoteUpdate(payload: string) {
    if (!this.isSubscriber) return;
    
    if (payload !== this.lastKnownContent) {
      try {
        this.lastKnownContent = payload;
        await this.clipboardy.write(payload);
        console.log(`[Clipboard] Received remote update of ${payload.length} chars.`);
      } catch (err) {
        console.error('[Clipboard] Failed to write remote update to local OS.', err);
      }
    }
  }

  async getLocalClipboard(): Promise<string> {
    if (!this.clipboardy) {
       this.clipboardy = (await import('clipboardy')).default;
    }
    return this.clipboardy.read();
  }

  stop() {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }
}
