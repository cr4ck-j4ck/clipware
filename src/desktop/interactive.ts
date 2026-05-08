import * as p from '@clack/prompts';
import pc from 'picocolors';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { DiscoveryManager, DiscoveredDevice } from '../network/discovery';
import { NetworkManager } from '../network/ws';
import { DesktopClipboard } from './clipboard';
import { startCommanderLoop } from './commander';

export async function startInteractiveDesktop() {
  p.intro(pc.bgCyan(pc.black(' Universal C-Lipsync ')));

  const deviceId = uuidv4();
  const deviceName = `${os.hostname()} - ${os.userInfo().username}`;
  
  p.log.step(`Local Device: ${deviceName}`);
  
  let clipManager: DesktopClipboard | null = null;
  
  const network = new NetworkManager(deviceId, async (msg) => {
    if (msg.type === 'CLIP_UPDATE' && msg.payload && clipManager) {
      await clipManager.handleRemoteUpdate(msg.payload);
    }
  });

  const port = await network.init();
  const discovery = new DiscoveryManager(deviceId, deviceName, port);
  discovery.start();
  
  let proceedToRole = false;

  while (!proceedToRole) {
    p.log.info('Scanning LAN for devices... (waiting 3 seconds)');
    await new Promise(r => setTimeout(r, 3000));

    const devices = discovery.getDiscoveredDevices();
    let targetDevice: DiscoveredDevice | null = null;
    
    const choices = devices.map(d => ({
      value: d,
      label: `${d.name} (${d.ip}:${d.port})`
    }));
    
    choices.push({ value: 'refresh' as any, label: 'Refresh / Wait for incoming connection' });
    choices.push({ value: 'manual' as any, label: 'Manual IP Connect' });
    if (network.isConnected) {
      choices.push({ value: 'proceed' as any, label: 'Proceed to Sync Role (Done connecting)' });
    }
    
    const selection = await p.select({
      message: network.isConnected 
        ? 'Connected! Connect to another device, or proceed?' 
        : 'Select a device to connect to:',
      options: choices,
    });
    
    if (p.isCancel(selection)) {
      p.outro('Cancelled.');
      process.exit(0);
    }

    if (selection === 'proceed') {
      proceedToRole = true;
      break;
    }
    
    if (selection === 'refresh') {
      const s = p.spinner();
      s.start(`Listening on port ${port}. Waiting for connections...`);
      let newlyConnected = false;
      const initialClients = (network as any).wsClients?.size + (network as any).clients?.size;
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 500));
        const currentClients = (network as any).wsClients?.size + (network as any).clients?.size;
        if (currentClients > initialClients) {
          newlyConnected = true;
          break;
        }
      }
      s.stop('Scan finished.');
      if (newlyConnected) {
        p.log.success(`Incoming connection established!`);
      }
      continue;
    }

    if (selection === 'manual') {
      const manualIp = await p.text({ message: 'Enter IP:PORT :' });
      if (manualIp && typeof manualIp === 'string' && manualIp.includes(':')) {
         const [ip, portStr] = manualIp.split(':');
         targetDevice = { name: 'Manual Device', ip, port: parseInt(portStr, 10), lastSeen: Date.now() };
      }
    } else {
      targetDevice = selection as DiscoveredDevice;
    }

    if (targetDevice) {
      const s = p.spinner();
      s.start(`Connecting to ${targetDevice.name}...`);
      const success = await network.connect(targetDevice.ip, targetDevice.port);
      if (success) {
        s.stop(`Connected to ${targetDevice.name}!`);
      } else {
        s.stop(`Failed to connect to ${targetDevice.name}.`);
      }
    }
  }

  const roleSelection = await p.select({
    message: 'Select Sync Role:',
    options: [
      { value: 'bidirectional', label: 'Bidirectional (Sync both ways)' },
      { value: 'publisher', label: 'Publisher (Only send local copy events to remote)' },
      { value: 'subscriber', label: 'Subscriber (Only receive remote events and overwrite local)' }
    ],
  });

  if (p.isCancel(roleSelection)) {
    process.exit(0);
  }

  clipManager = new DesktopClipboard(network);
  await clipManager.init(roleSelection as 'publisher' | 'subscriber' | 'bidirectional');
  
  p.note(`Sync active in ${roleSelection} mode.\nYou can also type commands below to send hardware instructions to any connected Pi!`);
  await startCommanderLoop(network, clipManager);
}
