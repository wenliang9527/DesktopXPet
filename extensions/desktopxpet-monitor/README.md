# DesktopXPet Monitor

Monitor VS Code / Cursor editor events and push status to [DesktopXPet](https://github.com/DesktopXPet) in real time.

## Features

- **File Save Detection** — Pushes `status=working` when you save a file
- **Active Editor Tracking** — Reports current file, line number, and language
- **Idle Detection** — Sends `status=idle` after configurable timeout of inactivity
- **Status Bar Indicator** — Shows connection status at a glance
- **Auto-connect on Startup** — Reads `~/.xpet/config.json` for token and port

## Installation

### From VSIX

```bash
cd extensions/desktopxpet-monitor
npm install
npm run compile
# Package and install the VSIX
```

### From Source

1. Open this folder in VS Code / Cursor
2. Press `F5` to launch the Extension Development Host
3. The extension activates automatically on startup

## Configuration

Open Settings (`Ctrl+,`) and search for "DesktopXPet Monitor", or edit `settings.json`:

```json
{
  "desktopxpet-monitor.serverPort": 9527,
  "desktopxpet-monitor.serverToken": "",
  "desktopxpet-monitor.idleTimeout": 60,
  "desktopxpet-monitor.enabled": true
}
```

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `serverPort` | number | `9527` | DesktopXPet API port |
| `serverToken` | string | `""` | API token (auto-read from `~/.xpet/config.json`) |
| `idleTimeout` | number | `60` | Seconds of inactivity before idle status |
| `enabled` | boolean | `true` | Enable or disable monitoring |

## How It Works

1. **On startup** — The extension reads your token from `~/.xpet/config.json` and connects to DesktopXPet
2. **On file save** — Sends `{"tool":"cursor","status":"working","summary":"Saved index.ts (TypeScript)"}`
3. **On editor switch** — Sends current file info with line number
4. **On typing** — Resets the idle timer; sends working status if currently idle
5. **On idle** — After `idleTimeout` seconds of no activity, sends `status=idle`

### API Format

```json
POST http://127.0.0.1:{port}/api/status
Headers:
  Content-Type: application/json
  x-pet-token: {token}
Body:
{
  "tool": "cursor",
  "status": "working",
  "summary": "Editing index.ts:42 (TypeScript)"
}
```

Status values: `idle` | `working` | `error` | `completed`

## Commands

| Command | Description |
|---------|-------------|
| `Toggle DesktopXPet Monitor` | Enable/disable the monitor |
| `Show DesktopXPet Status` | Show current connection status |

## Requirements

- VS Code 1.80.0 or later
- DesktopXPet running on `localhost:9527`

## Troubleshooting

- **Status bar shows "Error"** — DesktopXPet may not be running. Start it first.
- **No events appearing** — Check `~/.xpet/config.json` has a valid token
- **Wrong port** — Adjust `desktopxpet-monitor.serverPort` in settings

## License

MIT
