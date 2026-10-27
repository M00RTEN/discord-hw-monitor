# Hardware Monitor Overlay

A small BetterDiscord plugin that shows your CPU, GPU and RAM stats in the Discord sidebar. I wanted to keep an eye on temps while gaming without alt-tabbing, so I made this.

![Screenshot](screenshot.png)

It shows CPU temp and load, GPU temp and load, and RAM usage. It appears under Message Requests in DMs and under the server name in servers. If you have both an integrated and a dedicated GPU, it tries to pick the dedicated one. Hover a row to see the exact hardware name. It follows your Discord theme colors.

## What you need

- Windows (LibreHardwareMonitor only works there)
- BetterDiscord
- LibreHardwareMonitor running with its web server turned on

## Setup

**LibreHardwareMonitor first:**

1. Download and start it. Run it as admin, otherwise a lot of sensors won't show up.
2. Go to Options > Remote Web Server > Run.
3. Open http://localhost:8085/data.json in your browser. If you see a wall of JSON, you're good.

**Then the plugin:**

1. Download `HardwareMonitorOverlay.plugin.js` from this repo.
2. In Discord, go to Settings > Plugins > Open Plugins Folder.
3. Drop the file in there and enable it.

## Settings

There's no settings menu. Open the plugin file in a text editor and change the constants at the top:

- `DATA_URL` is where it fetches data from. Default is `http://localhost:8085/data.json`. You can point it at another PC on your network if you want.
- `UPDATE_MS` is how often it refreshes. Default is 2000 (every 2 seconds).
- `RAM_OFFSET` is a fudge factor for RAM. LibreHardwareMonitor and Task Manager calculate RAM usage a bit differently, so the numbers don't always match. Compare with Task Manager and adjust until they line up, or set it to 0 for the raw value.

## If something's off

**It says "Ingen data" / "No data":** LibreHardwareMonitor isn't running or the web server is off. Check the data.json link above.

**No temperatures:** run LibreHardwareMonitor as admin.

**Wrong GPU:** it picks the GPU with the most sensors and avoids integrated ones, which usually works but not always. Open an issue with your hardware names and I'll look at it.

**Overlay doesn't show up:** Discord updates sometimes break the sidebar layout. Try turning the plugin off and on, or reload with Ctrl+R. Still nothing? Open an issue.

## Privacy

It only talks to whatever `DATA_URL` points at, which is your own LibreHardwareMonitor by default. Nothing is sent anywhere else.

## Contributing

Bugs and PRs are welcome. Say which Discord, BetterDiscord and LibreHardwareMonitor versions you're on.

MIT licensed. Made by M00RTEN.
