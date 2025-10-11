import { config as loadEnv } from 'dotenv';
import { existsSync } from 'fs';

loadEnv();

export interface Config {
  discord: {
    token: string;
    adminUserIds: string[];
  };
  uptimeKuma: {
    url: string;
    username: string;
    password: string;
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
        url: process.env.UPTIME_KUMA_URL || 'http://localhost:3001',
        username: process.env.UPTIME_KUMA_USERNAME || '',
        password: process.env.UPTIME_KUMA_PASSWORD || '',
      },
      bot: {
        updateInterval: parseInt(process.env.UPDATE_INTERVAL || '60', 10) * 1000,
        embedColor: parseInt(process.env.EMBED_COLOR || '5814783', 10),
      },
    };
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

    if (!this.config.uptimeKuma.url) {
      errors.push('UPTIME_KUMA_URL is required');
    }

    if (!this.config.uptimeKuma.username) {
      errors.push('UPTIME_KUMA_USERNAME is required');
    }

    if (!this.config.uptimeKuma.password) {
      errors.push('UPTIME_KUMA_PASSWORD is required');
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

export const configManager = new ConfigManager();
export const config = configManager.getConfig();

