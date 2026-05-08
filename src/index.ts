import fs from 'fs';
import { startHeadlessPi } from './pi/headless';
import { startInteractiveDesktop } from './desktop/interactive';

function printHelp() {
  console.log(`
Universal C-Lipsync & Hardware Typer

Usage:
  pnpm start
  pnpm start -- -h
  pnpm start -- --help

Startup flow:
  1. If running on a Raspberry Pi (with /dev/hidg0 configured), the app automatically
     starts in Headless Hardware Typer Mode. It will wait for incoming WS commands
     to inject keystrokes via USB.
  2. If running on a standard Desktop (Windows/Linux/Mac), it launches an interactive TUI.
  3. Select a target device from the LAN discovery list.
  4. Choose your Sync Role:
     - Bidirectional: Syncs clipboard both ways.
     - Publisher: Only sends local clipboard copies to the remote device.
     - Subscriber: Only receives clipboard data from the remote device.
     - Hardware Commander: Opens a REPL to send your clipboard to a Pi Typer.

Commander Mode Commands:
  .typeclip
      Reads your local desktop clipboard and sends it to the connected Raspberry Pi
      to be typed out as hardware keystrokes.
      
  .quit
      Exits Commander Mode.
`);
}

async function bootstrap() {
  if (process.argv.includes('-h') || process.argv.includes('--help')) {
    printHelp();
    process.exit(0);
  }

  const isPiTyper = fs.existsSync('/dev/hidg0');
  
  if (isPiTyper) {
    console.log('[Init] Hardware Typer interface detected (/dev/hidg0).');
    console.log('[Init] Starting in Headless Pi Mode.');
    await startHeadlessPi();
  } else {
    // We are on a standard PC. Show the interactive UI.
    await startInteractiveDesktop();
  }
}

bootstrap().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
