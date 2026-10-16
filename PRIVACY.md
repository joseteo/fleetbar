# Fleetbar privacy

Fleetbar has no telemetry, analytics, advertising, account system or remote configuration service.

Your project names, groups, endpoint URLs, local paths and SSH identity-file paths are stored on your computer in `~/.config/fleetbar/projects.json`. The file is created with mode 0600 in a private directory. Refresh and appearance preferences are stored in GNOME GSettings.

Monitoring sends read-only HTTP GET requests or TCP connection attempts to destinations you configure. Those destination servers can see the connecting IP address and the HTTP user agent `Fleetbar/1.1`. No third-party monitoring server receives the results. HTTP headers can include the usual transport metadata; the extension does not add authentication headers or cookies.

The optional local monitor check reads only the selected state file. It does not read monitor credentials, send messages through another service, run generation jobs or query databases itself.

Website and folder shortcuts ask the desktop to open the configured location. Selecting Connect with SSH opens GNOME Terminal and SSH using your existing local configuration and identity file, if specified. It never reads private key contents.

Availability results live in memory and are discarded when the extension is disabled. Optional desktop notifications contain project/service names and the outage or recovery state. They follow your desktop notification settings.

The extension package contains no personal projects, keys, endpoint credentials or production instance names. Removing the extension does not automatically delete your configuration; remove `~/.config/fleetbar` and reset `/org/gnome/shell/extensions/fleetbar/` with dconf if you also want to remove saved settings.
