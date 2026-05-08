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
    const mod = await import('clipboardy');
    this.clipboardy = mod.default || mod;
    
    this.isPublisher = role === 'publisher' || role === 'bidirectional';
    this.isSubscriber = role === 'subscriber' || role === 'bidirectional';

    if (this.isPublisher) {
      try {
        this.lastKnownContent = await this.clipboardy.read();
      } catch (err) {
        // Windows clipboardy fallback panics if clipboard is empty or contains non-text.
        // We can safely ignore this initial read failure.
        this.lastKnownContent = '';
      }
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
       const mod = await import('clipboardy');
       this.clipboardy = mod.default || mod;
    }
    try {
      return await this.clipboardy.read();
    } catch (err) {
      return '';
    }
  }

  stop() {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }
}
