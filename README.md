# Uptime Kuma Discord Bot

A comprehensive Discord bot that integrates with [Uptime Kuma](https://github.com/louislam/uptime-kuma) to display real-time monitor status information in Discord channels.

## Features

- **Real-time Monitoring**: Socket.io connection with automatic updates
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
  -v bot-data:/app/data \
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
| `UPTIME_KUMA_USERNAME` | Uptime Kuma username | Yes | - |
| `UPTIME_KUMA_PASSWORD` | Uptime Kuma password | Yes | - |
| `UPDATE_INTERVAL` | Update interval in seconds | No | `60` |
| `EMBED_COLOR` | Decimal color code | No | `5814783` |
| `ADMIN_USER_IDS` | Comma-separated Discord user IDs | No | `` (all users) |

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

### Persistent Data

Configuration saved to Docker volume `bot-data`:
- Channel ID
- Message IDs (for reuse)
- Tracked monitors
- Groups and assignments
- Custom title

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
│   │   └── uptime-kuma.service.ts # Uptime Kuma Socket.io integration
│   ├── types/
│   │   └── uptime-kuma.ts     # TypeScript type definitions
│   ├── utils/
│   │   └── logger.ts          # Logging utility
│   └── index.ts               # Application entry point
├── data/                      # Persistent configuration (auto-created)
│   └── bot-config.json        # Stored settings and monitor groups
├── docker-compose.yml         # Docker Compose configuration
├── Dockerfile                 # Docker image definition
├── package.json               # Dependencies
└── tsconfig.json              # TypeScript configuration
```

## Why Not Use Uptime Kuma API Keys?

Uptime Kuma's [API Keys feature](https://github.com/louislam/uptime-kuma/wiki/API-Keys) (version >= 1.21.0) is designed for REST endpoints like Prometheus metrics, not Socket.io connections. This bot uses Socket.io for real-time monitor updates, which requires username/password authentication. API Keys are not supported for Socket.io authentication in Uptime Kuma.

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
