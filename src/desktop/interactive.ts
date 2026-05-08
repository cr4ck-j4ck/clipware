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
  
  p.log.info('Scanning LAN for devices... (waiting 3 seconds)');
  
  // Wait a moment for mDNS resolution
  await new Promise(r => setTimeout(r, 3000));
  
  const devices = discovery.getDiscoveredDevices();
  
  let targetDevice: DiscoveredDevice | null = null;
  
  if (devices.length === 0) {
    p.log.warn('No devices found via mDNS.');
    const manualIp = await p.text({
      message: 'Enter manual IP:PORT (e.g. 192.168.1.5:4321) to connect, or leave blank to listen only:'
    });
    
    if (p.isCancel(manualIp)) {
      p.outro('Cancelled.');
      process.exit(0);
    }
    
    if (manualIp && typeof manualIp === 'string' && manualIp.includes(':')) {
      const [ip, portStr] = manualIp.split(':');
      targetDevice = { name: 'Manual Device', ip, port: parseInt(portStr, 10) };
    }
  } else {
    const choices = devices.map(d => ({
      value: d,
      label: `${d.name} (${d.ip}:${d.port})`
    }));
    
    choices.push({ value: 'manual' as any, label: 'Manual IP Connect' });
    choices.push({ value: 'listen' as any, label: 'Wait for incoming connection' });
    
    const selection = await p.select({
      message: 'Select a device to connect to:',
      options: choices,
    });
    
    if (p.isCancel(selection)) {
      p.outro('Cancelled.');
      process.exit(0);
    }
    
    if (selection === 'manual') {
      const manualIp = await p.text({ message: 'Enter IP:PORT :' });
      if (manualIp && typeof manualIp === 'string' && manualIp.includes(':')) {
         const [ip, portStr] = manualIp.split(':');
         targetDevice = { name: 'Manual Device', ip, port: parseInt(portStr, 10) };
      }
    } else if (selection !== 'listen') {
      targetDevice = selection as DiscoveredDevice;
    }
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
  } else {
    p.log.info(`Listening for incoming connections on port ${port}...`);
  }

  const roleSelection = await p.select({
    message: 'Select Sync Role:',
    options: [
      { value: 'bidirectional', label: 'Bidirectional (Sync both ways)' },
      { value: 'publisher', label: 'Publisher (Only send local copy events to remote)' },
      { value: 'subscriber', label: 'Subscriber (Only receive remote events and overwrite local)' },
      { value: 'commander', label: 'Hardware Commander (Send to Pi)' }
    ],
  });

  if (p.isCancel(roleSelection)) {
    process.exit(0);
  }

  clipManager = new DesktopClipboard(network);
  
  if (roleSelection === 'commander') {
    await startCommanderLoop(network, clipManager);
  } else {
    await clipManager.init(roleSelection as 'publisher' | 'subscriber' | 'bidirectional');
    p.note(`Sync active in ${roleSelection} mode.\nPress Ctrl+C to quit.`);
  }
}
