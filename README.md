# Universal C-Lipsync & Hardware Typer

Universal C-Lipsync is a single-codebase CLI tool designed to bypass strict application-level restrictions (where standard copy/paste or software-based UI Automation fails). It achieves this by syncing clipboards over the Local Area Network (LAN) and providing a **Hardware Keystroke Injection** mode using a Raspberry Pi acting as a USB Human Interface Device (HID).

## How It Works

The architecture is built on a **Dynamic Role-Based System**. The single codebase determines its execution path at runtime:

1. **Hardware Check**: Upon execution, the app checks if the file `/dev/hidg0` exists.
2. **Headless Pi Mode**: If `/dev/hidg0` exists, the app assumes it's running on a pre-configured Raspberry Pi Zero/4. It skips the UI, broadcasts its presence on the network via mDNS (`bonjour-service`), and waits for WebSocket connections. When it receives text, it converts the ASCII characters into standard 8-byte USB HID keyboard reports and writes them to `/dev/hidg0`, typing them out on the connected target machine with a safe 30ms delay.
3. **Interactive Desktop Mode**: If `/dev/hidg0` does not exist, it boots an interactive Terminal User Interface (TUI) via `@clack/prompts`. It discovers available devices on the network, allows you to establish a connection, and offers specific sync roles.

## Installation

```bash
cd clipware
pnpm install
```

## Running the Application

### 1. On the Raspberry Pi (Target Machine Host)
Connect the Raspberry Pi to your target machine via the USB data port. Ensure USB Gadget mode (`dwc2`, `g_hid`) is configured so that `/dev/hidg0` exists.

Run the app (requires sudo to write to `/dev/hidg0`):
```bash
sudo pnpm start
```
The Pi will start in headless mode, broadcast "Raspberry Pi Typer", and wait.

### 2. On the Desktop (Your main workstation)
Ensure you are on the same LAN as the Pi (or the other desktop you want to sync with).
```bash
pnpm start
```
*Note: You can view CLI help at any time by running `pnpm start -- --help`.*

## Interactive Sync Roles (Desktop)

Once the TUI starts, you will select a discovered device (e.g., the Pi Typer or another Desktop) and choose a role:

- **Bidirectional**: Standard clipboard sync. When you copy something locally, it sends it to the remote machine. When the remote machine copies something, it overwrites your local clipboard.
- **Publisher**: Broadcast only. It watches your local clipboard and sends changes to the connected target. It ignores incoming payloads.
- **Subscriber**: Receive only. It listens for incoming payloads and writes them to your local OS clipboard. It does not monitor or send your local copies.
- **Hardware Commander**: Specialized mode for talking to the Raspberry Pi. It drops you into a REPL prompt.

## Hardware Commander Mode

When connected to a Raspberry Pi and the **Hardware Commander** role is selected, you can use the following commands in the prompt:

- `.typeclip`: Instantly reads whatever is currently in your Desktop's OS clipboard and streams it to the Raspberry Pi. The Pi will then act as a physical USB keyboard and literally "type" your clipboard contents into whatever text field is focused on the restricted machine.
- `.quit`: Exits Commander Mode.

## Advanced Network Configuration

If mDNS discovery fails (e.g., due to restrictive subnet routing or router isolation), you can use the **Manual IP Connect** option in the TUI.
When running the app on a listener device, it will print its listening port (e.g., `Listening for incoming connections on port 4321...`). You can input `<IP_ADDRESS>:4321` into the manual connection prompt on the other device.
