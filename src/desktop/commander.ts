import * as p from '@clack/prompts';
import { NetworkManager } from '../network/ws';
import { DesktopClipboard } from './clipboard';

export async function startCommanderLoop(network: NetworkManager, clipboard: DesktopClipboard) {
  p.note('Hardware Commander Mode\nType `.typeclip` to read your local clipboard and send it to the Pi.\nType `.quit` to exit.');
  
  while (true) {
    const action = await p.text({
      message: 'Enter command:',
      placeholder: '.typeclip',
    });

    if (p.isCancel(action)) {
      break;
    }

    if (action === '.quit') {
      break;
    }

    if (action === '.typeclip') {
      const text = await clipboard.getLocalClipboard();
      if (!text || text.trim() === '') {
        p.log.warn('Local clipboard is empty.');
      } else {
        p.log.info(`Sending ${text.length} characters to Pi for hardware injection...`);
        network.broadcast({
          type: 'REMOTE_TYPE',
          sourceId: 'commander',
          payload: text,
          timestamp: Date.now()
        });
      }
    } else {
      p.log.warn('Unknown command. Use .typeclip or .quit');
    }
  }

  p.outro('Exiting Commander Mode');
  process.exit(0);
}
