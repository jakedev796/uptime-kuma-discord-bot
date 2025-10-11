# Quick Start Guide

**Want to deploy to Fly.io instead?** See [FLY_DEPLOY.md](FLY_DEPLOY.md) for one-click deployment.

## Prerequisites

- Docker installed (or Node.js 18+)
- Discord bot created
- Uptime Kuma instance running

## Step 1: Create Discord Bot (2 minutes)

1. Go to https://discord.com/developers/applications
2. Click **"New Application"** and name it
3. Go to **"Bot"** tab, click **"Add Bot"**, then **"Reset Token"** and copy it
4. Go to **"OAuth2" → "URL Generator"**
5. Select scopes: `bot` + `applications.commands`
6. Select permissions: `Send Messages`, `Embed Links`, `Read Message History`, `Use Slash Commands`
7. Open the generated URL to invite bot to your server

## Step 2: Setup Bot (2 minutes)

```bash
git clone https://github.com/jakedev796/uptime-kuma-discord-bot
cd uptime-kuma-discord-bot
cp .env.example .env
```

**Edit `.env`** (only 3 required):
```env
DISCORD_BOT_TOKEN=your_discord_bot_token
UPTIME_KUMA_URL=http://uptime-kuma:3001
UPTIME_KUMA_USERNAME=admin
UPTIME_KUMA_PASSWORD=your_password
ADMIN_USER_IDS=your_discord_user_id
```

**Start it:**
```bash
docker-compose up -d
# or: npm install && npm run build && npm start
```

## Step 3: Configure in Discord (1 minute)

Type these commands in Discord:

```
/set-channel #status              # Pick channel from dropdown
/set-title Production Services    # Custom title (optional)
/track                           # Type to search, select monitor
/track                           # Repeat for more monitors!
# Or just:
/track-all                       # Track everything
```

Done!

## What's Next?

### Organize with Groups

```bash
/group-create Media Servers       # Create a group
/group-add-monitor                # Group dropdown, then monitor dropdown
  → Select: Your Group Name
  → Type: Your Monitor Name
  → Repeat for more monitors
  
/groups                          # See your organization
/config                          # See full status
```

### Quick Operations

```bash
/track              # Type monitor name, select from dropdown
/untrack            # Type monitor name, remove it
/group-remove-monitor # Remove monitor from its group
/group-delete       # Delete entire group
```

## Troubleshooting

### Commands don't appear
- Wait 5-10 minutes
- Kick and re-invite bot
- Restart Discord

### Bot won't connect
- Check `.env` credentials
- View logs: `docker-compose logs -f`
- Try `/config` in Discord

### Permission denied
- Add your Discord user ID to `ADMIN_USER_IDS` in `.env`
- Get ID: Right-click username → Copy ID
- Restart bot

## Commands Cheat Sheet

| Command | What it does |
|---------|--------------|
| `/set-channel` | Choose status channel |
| `/set-title` | Customize embed title |
| `/track` | Add monitor (autocomplete!) |
| `/untrack` | Remove monitor (autocomplete!) |
| `/track-all` | Track everything |
| `/group-create` | Create new group |
| `/group-delete` | Delete group (autocomplete!) |
| `/group-add-monitor` | Add to group (both autocomplete!) |
| `/group-remove-monitor` | Remove from group (autocomplete!) |
| `/groups` | List all groups |
| `/config` | See full status |

## Pro Tips

- **Create groups first**, then assign monitors
- **Use `/config`** to see everything at a glance
- **Start with `/track-all`** then organize into groups

---

**Need help?** Check [README.md](README.md) or open a GitHub issue.