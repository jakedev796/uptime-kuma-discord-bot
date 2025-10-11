import { Client, GatewayIntentBits, TextChannel, EmbedBuilder, Message, REST, Routes, MessageFlags } from 'discord.js';
import { config } from '../config/config';
import { configStorage } from '../config/storage';
import { MonitorStats, HeartbeatStatus } from '../types/uptime-kuma';
import { UptimeKumaService } from './uptime-kuma.service';
import { CommandsService } from './commands.service';
import { Logger } from '../utils/logger';

export class DiscordService {
  private client: Client;
  private channel: TextChannel | null = null;
  private logger: Logger;
  private maxMonitorsPerEmbed = 20;
  private commandsService: CommandsService;
  private uptimeKumaService: UptimeKumaService | null = null;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
      ],
    });
    this.logger = new Logger('DiscordService');
    this.commandsService = new CommandsService();
    (this.client as any).discordService = this;
  }

  public setUptimeKumaService(service: UptimeKumaService): void {
    this.uptimeKumaService = service;
  }

  public getClient(): Client {
    return this.client;
  }

  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.once('ready', async (client) => {
        this.logger.info(`Discord bot logged in as ${client.user?.tag}`);
        
        try {
          await this.initializeChannel();
          await this.registerCommands();
          this.setupCommandHandler();
          resolve();
        } catch (error: any) {
          this.logger.warn(`Channel initialization skipped: ${error.message}`);
          await this.registerCommands();
          this.setupCommandHandler();
          resolve();
        }
      });

      this.client.on('error', (error: Error) => {
        this.logger.error(`Discord client error: ${error.message}`);
      });

      this.client.login(config.discord.token).catch(reject);
    });
  }

  private async registerCommands(): Promise<void> {
    try {
      const commands = this.commandsService.getCommands().map(cmd => cmd.data.toJSON());
      
      const rest = new REST({ version: '10' }).setToken(config.discord.token);
      
      this.logger.info('Registering slash commands...');
      
      await rest.put(
        Routes.applicationCommands(this.client.user!.id),
        { body: commands }
      );
      
      this.logger.info(`Successfully registered ${commands.length} slash commands`);
    } catch (error: any) {
      this.logger.error(`Failed to register commands: ${error.message}`);
      throw error;
    }
  }

  private setupCommandHandler(): void {
    this.client.on('interactionCreate', async (interaction: any) => {
      if (interaction.isAutocomplete()) {
        await this.commandsService.handleAutocomplete(interaction, this.uptimeKumaService!);
        return;
      }

      if (!interaction.isChatInputCommand()) return;

      const command = this.commandsService.getCommand(interaction.commandName);
      
      if (!command) {
        this.logger.warn(`Unknown command: ${interaction.commandName}`);
        return;
      }

      try {
        if (!this.uptimeKumaService) {
          await interaction.reply({
            content: '❌ Uptime Kuma service not initialized',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await command.execute(interaction, this.uptimeKumaService);
      } catch (error: any) {
        this.logger.error(`Error executing command ${interaction.commandName}: ${error.message}`);
        
        const errorMessage = '❌ An error occurred while executing this command.';
        
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: errorMessage, flags: MessageFlags.Ephemeral });
        } else {
          await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
        }
      }
    });
  }

  private async initializeChannel(): Promise<void> {
    const channelId = configStorage.getChannelId();
    
    if (!channelId) {
      throw new Error('No channel configured. Use /set-channel command to set one.');
    }

    try {
      const channel = await this.client.channels.fetch(channelId);
      
      if (!channel || !channel.isTextBased() || channel.isDMBased()) {
        throw new Error('Invalid channel or channel is not a text channel');
      }

      this.channel = channel as TextChannel;
      this.logger.info(`Initialized channel: ${this.channel.name}`);
    } catch (error: any) {
      throw new Error(`Failed to initialize Discord channel: ${error.message}`);
    }
  }

  public async setChannel(channelId: string): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(channelId);
      
      if (!channel || !channel.isTextBased() || channel.isDMBased()) {
        throw new Error('Invalid channel or channel is not a text channel');
      }

      this.channel = channel as TextChannel;
      configStorage.setMessageIds([]);
      configStorage.setChannelId(channelId);
      this.logger.info(`Changed status channel to: ${this.channel.name}`);
    } catch (error: any) {
      throw new Error(`Failed to set channel: ${error.message}`);
    }
  }

  public async updateMonitorStatus(monitors: MonitorStats[]): Promise<void> {
    if (!this.channel) {
      this.logger.warn('Channel not initialized, skipping update');
      return;
    }

    try {
      const trackedIds = configStorage.getMonitorIds();
      const filteredMonitors = trackedIds.length === 0
        ? monitors
        : monitors.filter(m => trackedIds.includes(m.monitor.id));

      if (filteredMonitors.length === 0) {
        this.logger.warn('No monitors to display after filtering');
        return;
      }

      const embeds = this.createEmbeds(filteredMonitors, monitors.length);
      
      const messageIds = configStorage.getMessageIds();
      if (messageIds.length === 0) {
        await this.createNewMessages(embeds);
      } else {
        await this.updateExistingMessages(embeds);
      }
    } catch (error: any) {
      this.logger.error(`Failed to update monitor status: ${error.message}`);
    }
  }

  private createEmbeds(monitors: MonitorStats[], totalMonitors: number): EmbedBuilder[] {
    const embeds: EmbedBuilder[] = [];
    const statusMessage = configStorage.getStatusMessage();
    const groups = configStorage.getGroups();
    
    const embed = new EmbedBuilder()
      .setColor(configStorage.getEmbedColor())
      .setTitle(statusMessage)
      .setTimestamp()
      .setFooter({ text: 'Last updated' });

    const summary = this.generateSummary(monitors, totalMonitors);
    embed.setDescription(summary);

    if (groups.length > 0) {
      const monitorMap = new Map(monitors.map(m => [m.monitor.id, m]));
      const assignedIds = new Set<number>();

      for (const group of groups) {
        const groupMonitors = group.monitorIds
          .map(id => monitorMap.get(id))
          .filter((m): m is MonitorStats => m !== undefined);

        if (groupMonitors.length > 0) {
          groupMonitors.forEach(m => assignedIds.add(m.monitor.id));
          
          const monitorsList = groupMonitors.map(stats => 
            `${this.getStatusEmoji(stats.currentStatus)} **${stats.monitor.name}** - ${this.formatMonitorStatus(stats)}`
          ).join('\n');

          embed.addFields({
            name: `━━━━━━━━━━━━━━━━━━━━\n${group.name}`,
            value: monitorsList,
          });
        }
      }

      const ungrouped = monitors.filter(m => !assignedIds.has(m.monitor.id));
      if (ungrouped.length > 0) {
        const monitorsList = ungrouped.map(stats => 
          `${this.getStatusEmoji(stats.currentStatus)} **${stats.monitor.name}** - ${this.formatMonitorStatus(stats)}`
        ).join('\n');

        embed.addFields({
          name: '━━━━━━━━━━━━━━━━━━━━\nOther Services',
          value: monitorsList,
        });
      }
    } else {
      const monitorsList = monitors.map(stats => 
        `${this.getStatusEmoji(stats.currentStatus)} **${stats.monitor.name}** - ${this.formatMonitorStatus(stats)}`
      ).join('\n');

      embed.addFields({
        name: '━━━━━━━━━━━━━━━━━━━━\nMonitored Services',
        value: monitorsList || 'No monitors',
      });
    }

    embeds.push(embed);
    return embeds;
  }

  private getStatusEmoji(status: HeartbeatStatus): string {
    switch (status) {
      case HeartbeatStatus.UP:
        return '🟢';
      case HeartbeatStatus.DOWN:
        return '🔴';
      case HeartbeatStatus.PENDING:
        return '🟡';
      case HeartbeatStatus.MAINTENANCE:
        return '🔵';
      default:
        return '⚪';
    }
  }

  private formatMonitorStatus(stats: MonitorStats): string {
    const parts: string[] = [];
    
    parts.push(HeartbeatStatus[stats.currentStatus]);
    
    if (stats.uptime24h !== undefined) {
      parts.push(`${stats.uptime24h.toFixed(1)}% uptime`);
    }
    
    if (stats.avgPing !== undefined) {
      parts.push(`${stats.avgPing.toFixed(0)}ms`);
    }

    return parts.join(' • ');
  }

  private generateSummary(monitors: MonitorStats[], totalMonitors: number): string {
    if (monitors.length === 0) return '';

    const statusCounts = {
      up: monitors.filter(m => m.currentStatus === HeartbeatStatus.UP).length,
      down: monitors.filter(m => m.currentStatus === HeartbeatStatus.DOWN).length,
      pending: monitors.filter(m => m.currentStatus === HeartbeatStatus.PENDING).length,
      maintenance: monitors.filter(m => m.currentStatus === HeartbeatStatus.MAINTENANCE).length,
    };

    const total = monitors.length;
    const uptimePercentage = total > 0 ? ((statusCounts.up / total) * 100).toFixed(1) : '0';

    const trackingInfo = monitors.length < totalMonitors
      ? `**Tracking ${total} of ${totalMonitors} monitors**\n\n`
      : '';

    return trackingInfo +
           `**Overall Status:** ${uptimePercentage}% Operational\n\n` +
           `🟢 **Online:** ${statusCounts.up}\n` +
           `🔴 **Offline:** ${statusCounts.down}\n` +
           `🟡 **Pending:** ${statusCounts.pending}\n` +
           `🔵 **Maintenance:** ${statusCounts.maintenance}`;
  }

  private async createNewMessages(embeds: EmbedBuilder[]): Promise<void> {
    if (!this.channel) return;

    const newMessageIds: string[] = [];
    for (const embed of embeds) {
      const message = await this.channel.send({ embeds: [embed] });
      newMessageIds.push(message.id);
    }

    configStorage.setMessageIds(newMessageIds);
    this.logger.info(`Created ${embeds.length} new status message(s)`);
  }

  private async updateExistingMessages(embeds: EmbedBuilder[]): Promise<void> {
    if (!this.channel) return;

    const messageIds = configStorage.getMessageIds();
    const newMessageIds: string[] = [];

    for (let i = 0; i < embeds.length; i++) {
      try {
        if (i < messageIds.length) {
          const message = await this.channel.messages.fetch(messageIds[i]);
          await message.edit({ embeds: [embeds[i]] });
          newMessageIds.push(messageIds[i]);
        } else {
          const message = await this.channel.send({ embeds: [embeds[i]] });
          newMessageIds.push(message.id);
        }
      } catch (error: any) {
        this.logger.error(`Failed to update message: ${error.message}`);
        configStorage.setMessageIds([]);
        await this.createNewMessages(embeds);
        return;
      }
    }

    if (embeds.length < messageIds.length) {
      const toDelete = messageIds.slice(embeds.length);
      for (const messageId of toDelete) {
        try {
          const message = await this.channel.messages.fetch(messageId);
          await message.delete();
        } catch (error: any) {
          this.logger.warn(`Failed to delete message ${messageId}: ${error.message}`);
        }
      }
    }

    configStorage.setMessageIds(newMessageIds);
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  public disconnect(): void {
    this.logger.info('Disconnecting Discord bot');
    this.client.destroy();
  }
}

