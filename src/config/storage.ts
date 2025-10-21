import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Logger } from '../utils/logger';

export interface MonitorGroup {
  name: string;
  monitorIds: number[];
}

export interface GuildConfig {
  channelId: string | null;
  messageIds: string[];
  monitorIds: number[];
  groups: MonitorGroup[];
  updateInterval: number;
  embedColor: number;
  statusMessage: string;
}

export interface MultiGuildConfig {
  guilds: Record<string, GuildConfig>;
}

export class ConfigStorage {
  private configPath: string;
  private config: MultiGuildConfig;
  private logger: Logger;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.logger = new Logger('ConfigStorage');
    const dataDir = process.env.DATA_DIR || './data';
    
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    this.configPath = join(dataDir, 'bot-config.json');
    this.config = this.load();
  }

  private load(): MultiGuildConfig {
    if (existsSync(this.configPath)) {
      try {
        const data = readFileSync(this.configPath, 'utf-8');
        const loaded = JSON.parse(data);
        
        // Migration: Convert old single-guild format to multi-guild
        if (loaded.channelId !== undefined && !loaded.guilds) {
          this.logger.info('Migrating old config format to multi-guild format');
          return {
            guilds: {
              'legacy': {
                channelId: loaded.channelId || null,
                messageIds: loaded.messageIds || [],
                monitorIds: loaded.monitorIds || [],
                groups: loaded.groups || [],
                updateInterval: loaded.updateInterval || parseInt(process.env.UPDATE_INTERVAL || '60', 10) * 1000,
                embedColor: loaded.embedColor || parseInt(process.env.EMBED_COLOR || '5814783', 10),
                statusMessage: loaded.statusMessage || 'Service Status',
              }
            }
          };
        }
        
        this.logger.info('Loaded configuration from storage');
        return loaded;
      } catch (error: any) {
        this.logger.error(`Failed to load config: ${error.message}`);
      }
    }

    return { guilds: {} };
  }

  private save(): void {
    // Debounce saves to prevent excessive writes
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    this.saveTimeout = setTimeout(() => {
      this.forceSave();
    }, 100); // 100ms debounce
  }

  private forceSave(): void {
    try {
      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
      this.logger.info('Saved configuration to storage');
    } catch (error: any) {
      this.logger.error(`Failed to save config: ${error.message}`);
    }
    this.saveTimeout = null;
  }

  public flush(): void {
    // Force immediate save (useful for shutdown)
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.forceSave();
    }
  }

  private getDefaultConfig(): GuildConfig {
    return {
      channelId: null,
      messageIds: [],
      monitorIds: [],
      groups: [],
      updateInterval: parseInt(process.env.UPDATE_INTERVAL || '60', 10) * 1000,
      embedColor: parseInt(process.env.EMBED_COLOR || '5814783', 10),
      statusMessage: 'Service Status',
    };
  }

  private getGuildConfig(guildId: string, createIfMissing: boolean = true): GuildConfig {
    if (!this.config.guilds[guildId]) {
      if (!createIfMissing) {
        return this.getDefaultConfig(); // Return default without saving
      }
      this.config.guilds[guildId] = this.getDefaultConfig();
      this.save();
    }
    return this.config.guilds[guildId];
  }

  public guildExists(guildId: string): boolean {
    return !!this.config.guilds[guildId];
  }

  public getAllGuildIds(): string[] {
    return Object.keys(this.config.guilds);
  }

  public removeGuild(guildId: string): boolean {
    if (this.config.guilds[guildId]) {
      delete this.config.guilds[guildId];
      this.save();
      return true;
    }
    return false;
  }

  public getMonitorIds(guildId: string): number[] {
    const config = this.getGuildConfig(guildId);
    return [...config.monitorIds];
  }

  public setMonitorIds(guildId: string, ids: number[]): void {
    const config = this.getGuildConfig(guildId);
    config.monitorIds = ids;
    this.save();
  }

  public addMonitor(guildId: string, id: number): boolean {
    const config = this.getGuildConfig(guildId);
    if (!config.monitorIds.includes(id)) {
      config.monitorIds.push(id);
      this.save();
      return true;
    }
    return false;
  }

  public removeMonitor(guildId: string, id: number): boolean {
    const config = this.getGuildConfig(guildId);
    const index = config.monitorIds.indexOf(id);
    if (index > -1) {
      config.monitorIds.splice(index, 1);
      this.save();
      return true;
    }
    return false;
  }

  public clearMonitors(guildId: string): void {
    const config = this.getGuildConfig(guildId);
    config.monitorIds = [];
    this.save();
  }

  public getUpdateInterval(guildId: string): number {
    const config = this.getGuildConfig(guildId);
    return config.updateInterval;
  }

  public setUpdateInterval(guildId: string, interval: number): void {
    if (interval >= 10000) {
      const config = this.getGuildConfig(guildId);
      config.updateInterval = interval;
      this.save();
    }
  }

  public getEmbedColor(guildId: string): number {
    const config = this.getGuildConfig(guildId);
    return config.embedColor;
  }

  public setEmbedColor(guildId: string, color: number): void {
    const config = this.getGuildConfig(guildId);
    config.embedColor = color;
    this.save();
  }

  public getConfig(guildId: string): GuildConfig {
    return { ...this.getGuildConfig(guildId, false) }; // Don't auto-create when just reading
  }

  public getChannelId(guildId: string): string | null {
    if (!this.guildExists(guildId)) {
      return null; // Don't auto-create guild just to check channel
    }
    const config = this.getGuildConfig(guildId, false);
    return config.channelId;
  }

  public setChannelId(guildId: string, channelId: string): void {
    const config = this.getGuildConfig(guildId);
    config.channelId = channelId;
    this.save();
  }

  public getStatusMessage(guildId: string): string {
    const config = this.getGuildConfig(guildId);
    return config.statusMessage;
  }

  public setStatusMessage(guildId: string, message: string): void {
    const config = this.getGuildConfig(guildId);
    config.statusMessage = message;
    this.save();
  }

  public getMessageIds(guildId: string): string[] {
    const config = this.getGuildConfig(guildId);
    return [...config.messageIds];
  }

  public setMessageIds(guildId: string, ids: string[]): void {
    const config = this.getGuildConfig(guildId);
    config.messageIds = ids;
    this.save();
  }

  public getGroups(guildId: string): MonitorGroup[] {
    const config = this.getGuildConfig(guildId);
    return [...config.groups];
  }

  public addGroup(guildId: string, name: string): boolean {
    const config = this.getGuildConfig(guildId);
    if (config.groups.some(g => g.name.toLowerCase() === name.toLowerCase())) {
      return false;
    }
    config.groups.push({ name, monitorIds: [] });
    this.save();
    return true;
  }

  public removeGroup(guildId: string, name: string): boolean {
    const config = this.getGuildConfig(guildId);
    const index = config.groups.findIndex(g => g.name.toLowerCase() === name.toLowerCase());
    if (index > -1) {
      config.groups.splice(index, 1);
      this.save();
      return true;
    }
    return false;
  }

  public addMonitorToGroup(guildId: string, groupName: string, monitorId: number): boolean {
    const config = this.getGuildConfig(guildId);
    const group = config.groups.find(g => g.name.toLowerCase() === groupName.toLowerCase());
    if (group && !group.monitorIds.includes(monitorId)) {
      for (const g of config.groups) {
        const idx = g.monitorIds.indexOf(monitorId);
        if (idx > -1) {
          g.monitorIds.splice(idx, 1);
        }
      }
      group.monitorIds.push(monitorId);
      this.save();
      return true;
    }
    return false;
  }

  public removeMonitorFromGroup(guildId: string, monitorId: number): boolean {
    const config = this.getGuildConfig(guildId);
    let found = false;
    for (const group of config.groups) {
      const index = group.monitorIds.indexOf(monitorId);
      if (index > -1) {
        group.monitorIds.splice(index, 1);
        found = true;
      }
    }
    if (found) {
      this.save();
    }
    return found;
  }
}

export const configStorage = new ConfigStorage();

