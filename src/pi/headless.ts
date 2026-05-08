import fs from 'fs';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { charToHID, buildReportBuffer, buildEmptyReportBuffer } from './hid-mapper';
import { DiscoveryManager } from '../network/discovery';
import { NetworkManager } from '../network/ws';

const HID_DEV = '/dev/hidg0';
const TYPE_DELAY_MS = 30;

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function injectKeystrokes(text: string) {
  console.log(`[Pi Typer] Injecting ${text.length} characters...`);
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const report = charToHID(char);
    
    if (report) {
      // 1. Send Key Press
      const pressBuf = buildReportBuffer(report);
      fs.writeFileSync(HID_DEV, pressBuf);
      
      // 2. Wait a tiny bit (allow host to process press)
      await wait(10);
      
      // 3. Send Key Release
      const releaseBuf = buildEmptyReportBuffer();
      fs.writeFileSync(HID_DEV, releaseBuf);
      
      // 4. Delay before next char to prevent dropping characters
      await wait(TYPE_DELAY_MS);
    } else {
      console.warn(`[Pi Typer] Unmapped character ignored: "${char}"`);
    }
  }
  
  console.log(`[Pi Typer] Injection complete.`);
}

export async function startHeadlessPi() {
  const deviceId = uuidv4();
  const deviceName = os.hostname() + ' - Pi Typer';
  
  const network = new NetworkManager(deviceId, async (msg) => {
    switch (msg.type) {
      case 'REMOTE_TYPE':
        if (msg.payload) {
          await injectKeystrokes(msg.payload);
        }
        break;
      case 'HELLO':
        console.log(`[Server] Connection established from ${msg.sourceId}`);
        network.broadcast({ type: 'ACK', sourceId: deviceId, timestamp: Date.now() });
        break;
      default:
        // Ignore other messages in headless mode
        break;
    }
  });

  const port = await network.init();
  console.log(`[Pi Typer] WebSocket server listening on port ${port}`);

  const discovery = new DiscoveryManager(deviceId, deviceName, port);
  discovery.start();
  
  console.log(`[Pi Typer] Broadcasting mDNS presence as "${deviceName}". Waiting for commands...`);
}
