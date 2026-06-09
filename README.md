# Uptime Kuma Discord Bot

A comprehensive Discord bot that integrates with [Uptime Kuma](https://github.com/louislam/uptime-kuma) to display real-time monitor status information in Discord channels.

## Features

- **Real-time Monitoring**: Socket.io connection with automatic updates
- **Two connection modes**: `websocket` (username/password) or `metrics` (API key, no credentials) — see [Connection Modes](#connection-modes)
- **Multi-Guild Support**: Use the bot in multiple Discord servers with independent configurations
- **Slash Commands**: Configure everything directly from Discord with autocomplete
- **Rich Embeds**: Simple embeds with status indicators (green/red/yellow/blue circles)
- **Monitor Grouping**: Organize monitors into custom sections (Media, Gaming, etc.)
- **Persistent Configuration**: All settings saved automatically per server
- **Docker Support**: Full Docker and Docker Compose support
- **Fly.io Ready**: One-click deployment to Fly.io (free tier compatible)
- **Admin Controls**: Restrict commands to specific users
- **Auto-Reconnection**: Handles disconnections gracefully with infinite retry

## Commands

All configuration via simple, autocomplete-powered slash commands:

### Setup Commands
| Command | Description |
|---------|-------------|
| `/set-channel <channel>` | Set where to post status updates |
| `/set-title <title>` | Set the embed title (replaces "Uptime Kuma Status") |
| `/config` | Show full bot configuration and status |
| `/reset-config` | Reset this server's configuration (deletes embeds, clears all settings) |

### Monitor Commands
| Command | Description |
|---------|-------------|
| `/track <monitor>` | Add a monitor to tracking (autocomplete) |
| `/untrack <monitor>` | Remove a monitor from tracking (autocomplete) |
| `/track-all` | Track all available monitors |

### Group Commands
| Command | Description |
|---------|-------------|
| `/group-create <name>` | Create a new group (e.g., "Media Servers") |
| `/group-delete <group>` | Delete a group (autocomplete) |
| `/group-add-monitor <group> <monitor>` | Add monitor to group (both autocomplete) |
| `/group-remove-monitor <monitor>` | Remove monitor from its group (autocomplete) |
| `/groups` | List all groups and their monitors |

## Quick Start

### Deploy to Fly.io (Recommended)

See **[FLY_DEPLOY.md](FLY_DEPLOY.md)** for full instructions.

Super quick version:

```bash
fly launch --copy-config --auto-confirm --ha=false --name my-bot --now
fly secrets set DISCORD_BOT_TOKEN=xxx UPTIME_KUMA_URL=xxx UPTIME_KUMA_USERNAME=xxx UPTIME_KUMA_PASSWORD=xxx
# Then use /set-channel in Discord
```

### Self-Host with Docker

See **[QUICKSTART.md](QUICKSTART.md)** for detailed setup instructions.

**TL;DR:**
1. Create Discord bot and get token
2. Configure `.env` with bot token and Uptime Kuma credentials
3. Run: `docker-compose up -d` or `npm start`
4. Use `/set-channel` and `/track-all` in Discord

### DockerHub

Pre-built images are automatically available on DockerHub:

```bash
# Pull the latest image
docker pull boker02/uptime-kuma-discord-bot:latest

# Run with environment variables
docker run -d \
  --name uptime-kuma-discord-bot \
  -e DISCORD_BOT_TOKEN=your_token \
  -e UPTIME_KUMA_URL=your_url \
  -e UPTIME_KUMA_USERNAME=your_username \
  -e UPTIME_KUMA_PASSWORD=your_password \
  -e PUID=1001 \
  -e PGID=1001 \
  -v bot-data:/app/data \
  --restart unless-stopped \
  boker02/uptime-kuma-discord-bot:latest
```

## Usage

### Basic Setup

```bash
/set-channel #status       # Set status channel
/set-title My Services     # Customize title (optional)
/track-all                 # Track all monitors
/config                    # Verify setup
```

### Organizing with Groups

```bash
/group-create Media Servers    # Create group
/group-add-monitor             # Assign monitors (autocomplete)
/groups                        # View organization
```

For detailed usage examples, see [QUICKSTART.md](QUICKSTART.md).

## Embed Preview

With groups configured, your embed looks like this:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Production Services

Overall Status: 87.5% Operational

🟢 Online: 7
🔴 Offline: 1
🟡 Pending: 0
🔵 Maintenance: 0

━━━━━━━━━━━━━━━━━━━━
Media Servers
🟢 Plex - UP
🟢 Jellyfin - UP

━━━━━━━━━━━━━━━━━━━━
Gaming Servers
🔴 Minecraft - DOWN
🟢 Valheim - UP

━━━━━━━━━━━━━━━━━━━━
Other Services
🟢 Website - UP 

Last updated: 2:30 PM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Multi-Guild Support

The bot can be used in **multiple Discord servers simultaneously**, with each server having its own independent configuration:

- Each server has its own status channel
- Each server can track different monitors
- Each server can have different groups
- Each server has its own embed title and color settings

**Setup for multiple servers:**
1. Invite the bot to multiple Discord servers
2. In each server, run `/set-channel` to configure where status updates go
3. Configure monitors and groups independently in each server

**To reset a server's configuration:**
```
/reset-config    # Deletes all embeds and clears all settings for this server
```

This is useful when moving to a new channel or starting fresh.

## Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DISCORD_BOT_TOKEN` | Your Discord bot token | Yes | - |
| `UPTIME_KUMA_URL` | URL of your Uptime Kuma instance | Yes | `http://localhost:3001` |
| `UPTIME_KUMA_MODE` | Connection mode: `websocket` or `metrics` | No | `websocket` |
| `UPTIME_KUMA_USERNAME` | Uptime Kuma username | `websocket` mode only | - |
| `UPTIME_KUMA_PASSWORD` | Uptime Kuma password | `websocket` mode only | - |
| `UPTIME_KUMA_API_KEY` | Uptime Kuma API key | `metrics` mode only | - |
| `UPDATE_INTERVAL` | Update interval in seconds | No | `60` |
| `EMBED_COLOR` | Decimal color code | No | `5814783` |
| `ADMIN_USER_IDS` | Comma-separated Discord user IDs | No | `` (all users) |

### Connection Modes

The bot can read monitor data from Uptime Kuma in two ways, selected with `UPTIME_KUMA_MODE`:

| | `websocket` (default) | `metrics` |
|---|---|---|
| **Auth** | Username + password | API key only (no credentials) |
| **Transport** | Realtime socket.io push | Polls `/metrics` every `UPDATE_INTERVAL`s |
| **Set** | `UPTIME_KUMA_USERNAME`, `UPTIME_KUMA_PASSWORD` | `UPTIME_KUMA_API_KEY` |
| **Min. Uptime Kuma** | 1.0.0 | **1.21.0** (status + ping); **2.1.0** for 24h uptime % |
| **Best when** | You want instant updates | You'd rather not store admin credentials |

Both modes display the same data: status, response time (ping), and 24-hour uptime.

In `metrics` mode the bot checks the Uptime Kuma version on startup: it **refuses to run below 1.21.0** (API keys don't exist, so `/metrics` can't be authenticated), and **warns** on 1.21–2.0.x that 24h uptime % won't be shown (the `monitor_uptime_ratio` metric was added in 2.1.0; status and ping still work).

**Using `metrics` mode:**
1. In Uptime Kuma, go to **Settings → API Keys** and create a key (e.g. `uk1_...`).
2. In your `.env`:
   ```env
   UPTIME_KUMA_MODE=metrics
   UPTIME_KUMA_API_KEY=uk1_your_api_key_here
   # UPTIME_KUMA_USERNAME / PASSWORD are not needed
   ```

> ⚠️ Creating your **first** API key in Uptime Kuma permanently disables HTTP Basic auth (username/password) on its REST endpoints. This does not affect the websocket login, so `websocket` mode keeps working.

> 🔐 **Using 2FA?** If two-factor authentication is enabled on your Uptime Kuma account (2FA has been available since Uptime Kuma **1.7.0**), `websocket` mode **cannot** log in — the bot has no way to supply a TOTP code. In that case `metrics` mode is the only option, since its API key authenticates independently of 2FA.

### Setting Up Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and name it
3. Go to "Bot" section, click "Add Bot", then "Reset Token" and copy it
4. Go to "OAuth2" then "URL Generator"
5. Select scopes: `bot` and `applications.commands`
6. Select permissions: `Send Messages`, `Embed Links`, `Read Message History`, `Use Slash Commands`
7. Open the generated URL to invite the bot to your server

### Getting Your Discord User ID (For Admin Access)

1. Enable Developer Mode (User Settings → Advanced → Developer Mode)
2. Right-click your username and select "Copy ID"
3. Add to `.env`: `ADMIN_USER_IDS=your_user_id`

## Advanced Features

### Monitor Groups

Create organized sections in your embed:
- **Media Servers**: Plex, Jellyfin, etc.
- **Gaming**: Minecraft, Valheim, etc.
- **Infrastructure**: Nginx, databases, etc.
- **Other Services**: Ungrouped monitors appear here

Monitors can only be in ONE group at a time. Assigning to a new group automatically removes from the old one.


## Docker Configuration

### Docker Network (Same Host as Uptime Kuma)

```bash
# Create network
docker network create uptime-kuma-network

# Connect Uptime Kuma
docker network connect uptime-kuma-network uptime-kuma

# Update docker-compose.yml (uncomment networks section)
# Update .env:
UPTIME_KUMA_URL=http://uptime-kuma:3001
```

### Health Check

The bot includes a health check endpoint at `/health` that returns:
- `200` if both Discord and Uptime Kuma are connected
- `503` if either service is disconnected

Docker health check runs every 30 seconds and will mark the container as unhealthy if the bot can't connect to both services.

### Persistent Data

Configuration saved to Docker volume `botdata`:
- Channel ID
- Message IDs (for reuse)
- Tracked monitors
- Groups and assignments
- Custom title

### Docker Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PUID`/`PGID` | User/group IDs | `1001` |
| `DATA_DIR` | Data directory path | `/app/data` |
| `HEALTH_PORT` | Health check port | `3000` |

## Security

1. **Secure `.env`**: Never commit to version control
2. **Restrict admins**: Set `ADMIN_USER_IDS` to specific users
3. **Dedicated account**: Create a bot-specific Uptime Kuma user
4. **Minimal permissions**: Only grant necessary Discord permissions

## Troubleshooting

### Bot doesn't post updates
- Use `/set-channel` to set a channel
- Use `/config` to verify setup
- Check bot permissions in that channel

### Commands don't appear
- Wait 5-10 minutes (Discord caches)
- Try kicking and re-inviting bot
- Restart Discord client

### "Permission denied" on commands
- Add your user ID to `ADMIN_USER_IDS`
- Restart bot
- Get ID: Right-click username → Copy ID

### Autocomplete doesn't show monitors
- Ensure bot is connected to Uptime Kuma
- Check `/config` for connection status
- View logs: `docker-compose logs -f`

### Bot creates new messages after restart
- This is fixed! Bot now reuses messages
- Message IDs saved to `data/bot-config.json`
- Check logs for message handling status

### Docker-specific issues
- **Container unhealthy**: Check health endpoint `curl http://localhost:3000/health`
- **Container won't start**: Verify environment variables are set correctly
- **Data not persisting**: Ensure the `botdata` volume is properly mounted
- **Permission errors**: Adjust `PUID`/`PGID` in docker-compose.yml if needed

## Documentation Files

- **[README.md](README.md)** - This file
- **[QUICKSTART.md](QUICKSTART.md)** - Self-hosting setup guide
- **[FLY_DEPLOY.md](FLY_DEPLOY.md)** - Deploy to Fly.io (recommended)

## Tips

- Use `/config` to see everything at a glance
- Create groups BEFORE assigning monitors to them
- Use `/groups` to see your current organization
- `/track-all` then `/untrack` unwanted monitors is often faster

## Development

```bash
npm install
npm run dev  # Development mode with ts-node
npm test     # Run unit tests
npm run test:watch  # Run tests in watch mode
npm run test:coverage  # Run tests with coverage report
```

### Testing

The project includes unit tests covering:

- **Health Check Endpoint**: Tests the `/health` endpoint logic and response codes
- **Configuration Management**: Tests environment variable parsing and validation
- **Storage System**: Tests persistent configuration storage and guild management
- **Service Connections**: Tests Discord and Uptime Kuma service connection states

**Test Coverage:**
- Configuration validation and error handling
- Storage persistence and data integrity
- Health check endpoint responses
- Service connection state management

**Running Tests:**
```bash
npm test                    # Run all tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Generate coverage report
```

## Project Structure

```
uptime-kuma-discord-bot/
├── src/
│   ├── config/
│   │   ├── config.ts          # Environment configuration
│   │   └── storage.ts         # Persistent configuration storage
│   ├── services/
│   │   ├── commands.service.ts  # Discord slash commands with autocomplete
│   │   ├── discord.service.ts   # Discord bot service
│   │   ├── uptime-kuma.service.ts         # IUptimeKumaService + Socket.io (websocket mode)
│   │   ├── uptime-kuma.metrics.service.ts # /metrics polling (metrics mode)
│   │   └── uptime-kuma.factory.ts         # Selects mode from config
│   ├── types/
│   │   └── uptime-kuma.ts     # TypeScript type definitions
│   ├── utils/
│   │   └── logger.ts          # Logging utility
│   └── index.ts               # Application entry point
├── tests/                     # Unit tests
│   ├── config.test.ts         # Configuration tests
│   ├── discord.service.test.ts # Discord service tests
│   ├── health.test.ts         # Health check tests
│   ├── storage.test.ts        # Storage tests
│   ├── uptime-kuma.service.test.ts # Uptime Kuma service tests
│   └── setup.ts               # Test setup
├── data/                      # Persistent configuration (auto-created)
│   └── bot-config.json        # Stored settings and monitor groups
├── docker-compose.yml         # Docker Compose configuration
├── Dockerfile                 # Docker image definition
├── jest.config.js             # Jest testing configuration
├── package.json               # Dependencies
└── tsconfig.json              # TypeScript configuration
```

## API Keys vs. Username/Password

Uptime Kuma's [API Keys](https://github.com/louislam/uptime-kuma/wiki/API-Keys) only authenticate REST endpoints like Prometheus `/metrics` — **not** the Socket.io connection. So the two connection modes use different credentials:

- **`websocket` mode** uses Socket.io for realtime push, which requires **username/password** (API keys are not accepted here on any Uptime Kuma version, including 2.4.x).
- **`metrics` mode** polls the `/metrics` REST endpoint, which **does** accept an API key — letting you run the bot without storing admin credentials.

Pick whichever fits your security needs; see [Connection Modes](#connection-modes) above.

## License

MIT License - see [LICENSE](LICENSE)

## Resources

- [Uptime Kuma](https://github.com/louislam/uptime-kuma)
- [Discord.js](https://discord.js.org/)
- [Socket.io](https://socket.io/)

## Support

If you encounter issues:
1. Check the logs: `docker-compose logs -f`
2. Verify your `.env` configuration
3. Try `/config` command to check connection status
4. Open an issue on GitHub with details
