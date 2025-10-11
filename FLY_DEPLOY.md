# Deploy to Fly.io

Deploy your Uptime Kuma Discord Bot to Fly.io with minimal resources (free tier compatible).

## Prerequisites

- Fly.io account (sign up at https://fly.io)
- Fly CLI installed (`brew install flyctl` or see https://fly.io/docs/hands-on/install-flyctl/)
- Discord bot token
- Uptime Kuma credentials

## Quick Deploy

### 1. Clone and Navigate

```bash
git clone https://github.com/jakedev796/uptime-kuma-discord-bot
cd uptime-kuma-discord-bot
```

### 2. Login to Fly.io

```bash
fly auth login
```

### 3. Deploy

```bash
fly launch --copy-config --auto-confirm --ha=false --name your-unique-bot-name --now
```

This will:
- Create the app with minimal resources (256MB RAM, 1 shared CPU)
- Create a 1GB volume for persistent data
- Deploy the bot immediately

### 4. Set Secrets

```bash
fly secrets set \
  DISCORD_BOT_TOKEN=your_discord_bot_token_here \
  UPTIME_KUMA_URL=https://your-uptime-kuma-url.com \
  UPTIME_KUMA_USERNAME=admin \
  UPTIME_KUMA_PASSWORD=your_password_here \
  ADMIN_USER_IDS=your_discord_user_id
```

The bot will automatically restart with the new secrets.

### 5. Verify Deployment

```bash
fly logs     # Check startup logs
fly status   # Verify it's running
```

### 6. Configure in Discord

```
/set-channel #status
/set-title Production Services
/track-all
```

Done! Your bot is running on Fly.io!

## Configuration

The `fly.toml` is pre-configured for minimal resources:
- **CPU**: 1 shared CPU
- **Memory**: 256MB (minimal but sufficient for this bot)
- **Volume**: 1GB for persistent configuration
- **Region**: `iad` (Ashburn, VA - change if needed)
- **Always on**: `auto_stop_machines = false` and `min_machines_running = 1`
- **Single instance**: `ha = false` (no high availability needed)

## Managing Your Deployment

### View Logs

```bash
fly logs
```

### Check Status

```bash
fly status
```

### Scale Resources (if needed)

```bash
fly scale memory 512  # Increase to 512MB
fly scale count 1     # Ensure single instance
```

### Update Secrets

```bash
fly secrets set UPTIME_KUMA_PASSWORD=new_password
```

### Redeploy After Code Changes

```bash
fly deploy
```

### SSH into the App

```bash
fly ssh console
```

## Costs

With this configuration:
- **Shared CPU-1x @ 256MB**: ~$1.94/month
- **1GB Volume**: Free (3GB included)
- **Bandwidth**: Free (100GB included)

**Total**: ~$2/month or free with Fly.io credits

## Regions

Change the region in `fly.toml` if needed:
- `iad` - Ashburn, Virginia (US)
- `lhr` - London, UK
- `fra` - Frankfurt, Germany
- `syd` - Sydney, Australia
- `nrt` - Tokyo, Japan

Full list: https://fly.io/docs/reference/regions/

## Troubleshooting

### Bot not starting

```bash
fly logs          # Check for errors
fly status        # Verify it's running
```

### Update environment variables

```bash
fly secrets list  # See all secrets
fly secrets set KEY=value
```

### Bot keeps restarting

- Check memory usage: `fly scale show`
- Increase if needed: `fly scale memory 512`
- Check logs for errors: `fly logs`

### Volume issues

```bash
fly volumes list              # List volumes
fly volumes delete bot_data   # Delete if needed
fly volumes create bot_data --size 1  # Recreate
```

## Cleanup

To delete the app:

```bash
fly apps destroy your-app-name
```

## Support

For Fly.io specific issues:
- Fly.io Docs: https://fly.io/docs/
- Fly.io Community: https://community.fly.io/

For bot issues:
- Check [README.md](README.md)
- Open GitHub issue

