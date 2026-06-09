import { config as loadEnv } from 'dotenv';
import { existsSync } from 'fs';

loadEnv();

export type UptimeKumaMode = 'websocket' | 'metrics';

export interface Config {
  discord: {
    token: string;
    adminUserIds: string[];
  };
  uptimeKuma: {
    mode: UptimeKumaMode;
    url: string;
    username: string;
    password: string;
    apiKey: string;
  };
  bot: {
    updateInterval: number;
    embedColor: number;
  };
}

class ConfigManager {
  private config: Config;

  constructor() {
    this.config = this.loadConfig();
    this.validateConfig();
  }

  private loadConfig(): Config {
    return {
      discord: {
        token: process.env.DISCORD_BOT_TOKEN || '',
        adminUserIds: this.parseAdminUserIds(process.env.ADMIN_USER_IDS),
      },
      uptimeKuma: {
        mode: this.parseMode(process.env.UPTIME_KUMA_MODE),
        url: (process.env.UPTIME_KUMA_URL && process.env.UPTIME_KUMA_URL.trim() !== '') ? process.env.UPTIME_KUMA_URL : (process.env.UPTIME_KUMA_URL === '' ? '' : 'http://localhost:3001'),
        username: process.env.UPTIME_KUMA_USERNAME || '',
        password: process.env.UPTIME_KUMA_PASSWORD || '',
        apiKey: process.env.UPTIME_KUMA_API_KEY || '',
      },
      bot: {
        updateInterval: parseInt(process.env.UPDATE_INTERVAL || '60', 10) * 1000,
        embedColor: parseInt(process.env.EMBED_COLOR || '5814783', 10),
      },
    };
  }

  private parseMode(mode: string | undefined): UptimeKumaMode {
    // default to websocket so existing username/password setups keep working
    const normalized = (mode || 'websocket').trim().toLowerCase();
    return normalized as UptimeKumaMode;
  }

  private parseAdminUserIds(ids: string | undefined): string[] {
    if (!ids || ids.trim() === '') {
      return [];
    }
    return ids.split(',').map(id => id.trim()).filter(id => id.length > 0);
  }

  private validateConfig(): void {
    const errors: string[] = [];

    if (!this.config.discord.token) {
      errors.push('DISCORD_BOT_TOKEN is required');
    }

    if (this.config.uptimeKuma.mode !== 'websocket' && this.config.uptimeKuma.mode !== 'metrics') {
      errors.push(`UPTIME_KUMA_MODE must be either 'websocket' or 'metrics' (got '${this.config.uptimeKuma.mode}')`);
    }

    if (!this.config.uptimeKuma.url) {
      errors.push('UPTIME_KUMA_URL is required');
    }

    if (this.config.uptimeKuma.mode === 'metrics') {
      // metrics mode uses an api key, no username/password
      if (!this.config.uptimeKuma.apiKey) {
        errors.push("UPTIME_KUMA_API_KEY is required when UPTIME_KUMA_MODE='metrics'");
      }
    } else {
      // websocket login needs credentials
      if (!this.config.uptimeKuma.username) {
        errors.push('UPTIME_KUMA_USERNAME is required');
      }

      if (!this.config.uptimeKuma.password) {
        errors.push('UPTIME_KUMA_PASSWORD is required');
      }
    }

    if (this.config.bot.updateInterval < 10000) {
      errors.push('UPDATE_INTERVAL must be at least 10 seconds');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
  }

  public getConfig(): Config {
    return this.config;
  }
}

export { ConfigManager };
export const configManager = new ConfigManager();
export const config = configManager.getConfig();

