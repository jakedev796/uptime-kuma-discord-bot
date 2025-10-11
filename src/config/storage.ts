import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Logger } from '../utils/logger';

export interface MonitorGroup {
  name: string;
  monitorIds: number[];
}

export interface BotConfig {
  channelId: string | null;
  messageIds: string[];
  monitorIds: number[];
  groups: MonitorGroup[];
  updateInterval: number;
  embedColor: number;
  statusMessage: string;
}

export class ConfigStorage {
  private configPath: string;
  private config: BotConfig;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('ConfigStorage');
    const dataDir = process.env.DATA_DIR || './data';
    
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    this.configPath = join(dataDir, 'bot-config.json');
    this.config = this.load();
  }

  private load(): BotConfig {
    if (existsSync(this.configPath)) {
      try {
        const data = readFileSync(this.configPath, 'utf-8');
        const loaded = JSON.parse(data);
        this.logger.info('Loaded configuration from storage');
        return {
          channelId: loaded.channelId || null,
          messageIds: loaded.messageIds || [],
          monitorIds: loaded.monitorIds || [],
          groups: loaded.groups || [],
          updateInterval: loaded.updateInterval || parseInt(process.env.UPDATE_INTERVAL || '60', 10) * 1000,
          embedColor: loaded.embedColor || parseInt(process.env.EMBED_COLOR || '5814783', 10),
          statusMessage: loaded.statusMessage || 'Service Status',
        };
      } catch (error: any) {
        this.logger.error(`Failed to load config: ${error.message}`);
      }
    }

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

  private save(): void {
    try {
      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
      this.logger.info('Saved configuration to storage');
    } catch (error: any) {
      this.logger.error(`Failed to save config: ${error.message}`);
    }
  }

  public getMonitorIds(): number[] {
    return [...this.config.monitorIds];
  }

  public setMonitorIds(ids: number[]): void {
    this.config.monitorIds = ids;
    this.save();
  }

  public addMonitor(id: number): boolean {
    if (!this.config.monitorIds.includes(id)) {
      this.config.monitorIds.push(id);
      this.save();
      return true;
    }
    return false;
  }

  public removeMonitor(id: number): boolean {
    const index = this.config.monitorIds.indexOf(id);
    if (index > -1) {
      this.config.monitorIds.splice(index, 1);
      this.save();
      return true;
    }
    return false;
  }

  public clearMonitors(): void {
    this.config.monitorIds = [];
    this.save();
  }

  public getUpdateInterval(): number {
    return this.config.updateInterval;
  }

  public setUpdateInterval(interval: number): void {
    if (interval >= 10000) {
      this.config.updateInterval = interval;
      this.save();
    }
  }

  public getEmbedColor(): number {
    return this.config.embedColor;
  }

  public setEmbedColor(color: number): void {
    this.config.embedColor = color;
    this.save();
  }

  public getConfig(): BotConfig {
    return { ...this.config };
  }

  public getChannelId(): string | null {
    return this.config.channelId;
  }

  public setChannelId(channelId: string): void {
    this.config.channelId = channelId;
    this.save();
  }

  public getStatusMessage(): string {
    return this.config.statusMessage;
  }

  public setStatusMessage(message: string): void {
    this.config.statusMessage = message;
    this.save();
  }

  public getMessageIds(): string[] {
    return [...this.config.messageIds];
  }

  public setMessageIds(ids: string[]): void {
    this.config.messageIds = ids;
    this.save();
  }

  public getGroups(): MonitorGroup[] {
    return [...this.config.groups];
  }

  public addGroup(name: string): boolean {
    if (this.config.groups.some(g => g.name.toLowerCase() === name.toLowerCase())) {
      return false;
    }
    this.config.groups.push({ name, monitorIds: [] });
    this.save();
    return true;
  }

  public removeGroup(name: string): boolean {
    const index = this.config.groups.findIndex(g => g.name.toLowerCase() === name.toLowerCase());
    if (index > -1) {
      this.config.groups.splice(index, 1);
      this.save();
      return true;
    }
    return false;
  }

  public addMonitorToGroup(groupName: string, monitorId: number): boolean {
    const group = this.config.groups.find(g => g.name.toLowerCase() === groupName.toLowerCase());
    if (group && !group.monitorIds.includes(monitorId)) {
      for (const g of this.config.groups) {
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

  public removeMonitorFromGroup(monitorId: number): boolean {
    let found = false;
    for (const group of this.config.groups) {
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

