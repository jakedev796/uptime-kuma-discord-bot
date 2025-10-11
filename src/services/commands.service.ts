import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandOptionsOnlyBuilder,
  MessageFlags,
} from 'discord.js';
import { config } from '../config/config';
import { configStorage } from '../config/storage';
import { UptimeKumaService } from './uptime-kuma.service';
import { Logger } from '../utils/logger';

export interface Command {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction, uptimeKuma: UptimeKumaService) => Promise<void>;
}

export class CommandsService {
  private logger: Logger;
  private commands: Map<string, Command>;

  constructor() {
    this.logger = new Logger('CommandsService');
    this.commands = new Map();
    this.registerCommands();
  }

  private registerCommands(): void {
    const commands: Command[] = [
      {
        data: new SlashCommandBuilder()
          .setName('track')
          .setDescription('Add a monitor to tracking')
          .addStringOption(option =>
            option
              .setName('monitor')
              .setDescription('Select monitor to track')
              .setRequired(true)
              .setAutocomplete(true)
          ),
        execute: this.addMonitor.bind(this),
      },
      {
        data: new SlashCommandBuilder()
          .setName('untrack')
          .setDescription('Remove a monitor from tracking')
          .addStringOption(option =>
            option
              .setName('monitor')
              .setDescription('Select monitor to untrack')
              .setRequired(true)
              .setAutocomplete(true)
          ),
        execute: this.removeMonitor.bind(this),
      },
      {
        data: new SlashCommandBuilder()
          .setName('track-all')
          .setDescription('Track all available monitors'),
        execute: this.trackAll.bind(this),
      },
      {
        data: new SlashCommandBuilder()
          .setName('group-create')
          .setDescription('Create a new monitor group')
          .addStringOption(option =>
            option
              .setName('name')
              .setDescription('Name of the group (e.g., "Media Servers")')
              .setRequired(true)
              .setMaxLength(50)
          ),
        execute: this.addGroup.bind(this),
      },
      {
        data: new SlashCommandBuilder()
          .setName('group-delete')
          .setDescription('Delete a monitor group')
          .addStringOption(option =>
            option
              .setName('group')
              .setDescription('Select group to delete')
              .setRequired(true)
              .setAutocomplete(true)
          ),
        execute: this.removeGroup.bind(this),
      },
      {
        data: new SlashCommandBuilder()
          .setName('group-add-monitor')
          .setDescription('Add a monitor to a group')
          .addStringOption(option =>
            option
              .setName('group')
              .setDescription('Select group')
              .setRequired(true)
              .setAutocomplete(true)
          )
          .addStringOption(option =>
            option
              .setName('monitor')
              .setDescription('Select monitor')
              .setRequired(true)
              .setAutocomplete(true)
          ),
        execute: this.assignMonitorToGroup.bind(this),
      },
      {
        data: new SlashCommandBuilder()
          .setName('group-remove-monitor')
          .setDescription('Remove a monitor from its group')
          .addStringOption(option =>
            option
              .setName('monitor')
              .setDescription('Select monitor to unassign')
              .setRequired(true)
              .setAutocomplete(true)
          ),
        execute: this.unassignMonitor.bind(this),
      },
      {
        data: new SlashCommandBuilder()
          .setName('groups')
          .setDescription('List all groups and monitors'),
        execute: this.listGroups.bind(this),
      },
      {
        data: new SlashCommandBuilder()
          .setName('set-channel')
          .setDescription('Set the status update channel')
          .addChannelOption(option =>
            option
              .setName('channel')
              .setDescription('The channel to post status updates in')
              .setRequired(true)
          ),
        execute: this.setChannel.bind(this),
      },
      {
        data: new SlashCommandBuilder()
          .setName('set-title')
          .setDescription('Set the embed title')
          .addStringOption(option =>
            option
              .setName('title')
              .setDescription('Embed title (e.g., "Production Services")')
              .setRequired(true)
              .setMaxLength(100)
          ),
        execute: this.setMessage.bind(this),
      },
      {
        data: new SlashCommandBuilder()
          .setName('config')
          .setDescription('Show current bot configuration'),
        execute: this.showConfig.bind(this),
      },
    ];

    for (const command of commands) {
      this.commands.set(command.data.name, command);
    }

    this.logger.info(`Registered ${this.commands.size} slash commands`);
  }

  private isAdmin(userId: string): boolean {
    if (config.discord.adminUserIds.length === 0) {
      return true;
    }
    return config.discord.adminUserIds.includes(userId);
  }

  private async checkAdmin(interaction: ChatInputCommandInteraction): Promise<boolean> {
    if (!this.isAdmin(interaction.user.id)) {
      await interaction.reply({
        content: '❌ You do not have permission to use this command.',
        flags: MessageFlags.Ephemeral,
      });
      return false;
    }
    return true;
  }


  private async addMonitor(
    interaction: ChatInputCommandInteraction,
    uptimeKuma: UptimeKumaService
  ): Promise<void> {
    if (!await this.checkAdmin(interaction)) return;

    const monitorIdStr = interaction.options.getString('monitor', true);
    const monitorId = parseInt(monitorIdStr, 10);

    const currentIds = configStorage.getMonitorIds();
    if (currentIds.includes(monitorId)) {
      await interaction.reply({
        content: '⚠️ This monitor is already being tracked.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const newIds = [...currentIds, monitorId];
    configStorage.setMonitorIds(newIds);

    const monitors = uptimeKuma.getAllMonitors();
    const monitorName = monitors.get(monitorId)?.name || `ID ${monitorId}`;

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Monitor Added')
      .setDescription(`Now tracking: **${monitorName}**\n\nTotal tracked: ${newIds.length} monitors`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  private async removeMonitor(
    interaction: ChatInputCommandInteraction,
    uptimeKuma: UptimeKumaService
  ): Promise<void> {
    if (!await this.checkAdmin(interaction)) return;

    const monitorIdStr = interaction.options.getString('monitor', true);
    const monitorId = parseInt(monitorIdStr, 10);

    const currentIds = configStorage.getMonitorIds();
    const newIds = currentIds.filter(id => id !== monitorId);
    
    if (currentIds.length === newIds.length) {
      await interaction.reply({
        content: '⚠️ This monitor was not being tracked.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    configStorage.setMonitorIds(newIds);

    const monitors = uptimeKuma.getAllMonitors();
    const monitorName = monitors.get(monitorId)?.name || `ID ${monitorId}`;

    const embed = new EmbedBuilder()
      .setColor(0xff9900)
      .setTitle('🗑️ Monitor Removed')
      .setDescription(`Stopped tracking: **${monitorName}**\n\nTotal tracked: ${newIds.length || 'All monitors'}`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  private async trackAll(
    interaction: ChatInputCommandInteraction,
    uptimeKuma: UptimeKumaService
  ): Promise<void> {
    if (!await this.checkAdmin(interaction)) return;

    configStorage.clearMonitors();

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('🌐 Tracking All Monitors')
      .setDescription('Now tracking all available monitors from Uptime Kuma')
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }



  private async setChannel(
    interaction: ChatInputCommandInteraction,
    uptimeKuma: UptimeKumaService
  ): Promise<void> {
    if (!await this.checkAdmin(interaction)) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channel = interaction.options.getChannel('channel', true);

    try {
      const discordService = (interaction.client as any).discordService;
      if (discordService) {
        await discordService.setChannel(channel.id);
        
        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('✅ Status Channel Updated')
          .setDescription(`Status updates will now be posted in <#${channel.id}>`)
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } else {
        throw new Error('Discord service not available');
      }
    } catch (error: any) {
      await interaction.editReply({
        content: `❌ Failed to set channel: ${error.message}`,
      });
    }
  }

  private async setMessage(
    interaction: ChatInputCommandInteraction,
    uptimeKuma: UptimeKumaService
  ): Promise<void> {
    if (!await this.checkAdmin(interaction)) return;

    const message = interaction.options.getString('message', true);
    
    configStorage.setStatusMessage(message);

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Status Message Updated')
      .setDescription(`Status message set to: **${message}**\n\nThis will appear in the embed title on the next update.`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  private async showConfig(
    interaction: ChatInputCommandInteraction,
    uptimeKuma: UptimeKumaService
  ): Promise<void> {
    if (!await this.checkAdmin(interaction)) return;

    const botConfig = configStorage.getConfig();
    const trackedIds = botConfig.monitorIds;
    const channelId = botConfig.channelId;
    const groups = configStorage.getGroups();
    const monitors = uptimeKuma.getAllMonitors();

    const embed = new EmbedBuilder()
      .setColor(configStorage.getEmbedColor())
      .setTitle('⚙️ Bot Configuration & Status')
      .addFields(
        {
          name: '📢 Status Channel',
          value: channelId ? `<#${channelId}>` : '⚠️ Not set - use `/set-channel`',
          inline: false,
        },
        {
          name: '📝 Embed Title',
          value: botConfig.statusMessage,
          inline: true,
        },
        {
          name: '⏱️ Update Interval',
          value: `${botConfig.updateInterval / 1000}s`,
          inline: true,
        },
        {
          name: '🔌 Uptime Kuma',
          value: uptimeKuma.isConnected() ? '🟢 Connected' : '🔴 Disconnected',
          inline: true,
        },
        {
          name: '📊 Total Monitors',
          value: `${monitors.size} available`,
          inline: true,
        },
        {
          name: '🎯 Tracking',
          value: trackedIds.length === 0 ? 'All monitors' : `${trackedIds.length} monitors`,
          inline: true,
        },
        {
          name: '📁 Groups',
          value: groups.length === 0 ? 'None' : `${groups.length} groups`,
          inline: true,
        }
      );

    if (trackedIds.length > 0 && trackedIds.length <= 10) {
      const trackedNames = trackedIds
        .map(id => monitors.get(id)?.name || `ID ${id}`)
        .join(', ');
      embed.addFields({
        name: '━━━━━━━━━━━━━━\n🎯 Tracked Monitors',
        value: trackedNames,
        inline: false,
      });
    }

    if (groups.length > 0) {
      const groupSummary = groups
        .map(g => `**${g.name}**: ${g.monitorIds.length} monitors`)
        .join('\n');
      embed.addFields({
        name: '━━━━━━━━━━━━━━\n📁 Groups',
        value: groupSummary,
        inline: false,
      });
    }

    embed.setTimestamp();
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  private async addGroup(
    interaction: ChatInputCommandInteraction,
    uptimeKuma: UptimeKumaService
  ): Promise<void> {
    if (!await this.checkAdmin(interaction)) return;

    const name = interaction.options.getString('name', true);
    
    const success = configStorage.addGroup(name);

    if (success) {
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Group Created')
        .setDescription(`Group **${name}** has been created.\n\nUse \`/group-add-monitor\` to add monitors to this group.`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({
        content: `❌ A group named **${name}** already exists.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  private async removeGroup(
    interaction: ChatInputCommandInteraction,
    uptimeKuma: UptimeKumaService
  ): Promise<void> {
    if (!await this.checkAdmin(interaction)) return;

    const groupName = interaction.options.getString('group', true);
    
    const success = configStorage.removeGroup(groupName);

    if (success) {
      const embed = new EmbedBuilder()
        .setColor(0xff9900)
        .setTitle('🗑️ Group Deleted')
        .setDescription(`Group **${groupName}** has been deleted.\n\nMonitors are now ungrouped.`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({
        content: `❌ Group **${groupName}** not found.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  private async assignMonitorToGroup(
    interaction: ChatInputCommandInteraction,
    uptimeKuma: UptimeKumaService
  ): Promise<void> {
    if (!await this.checkAdmin(interaction)) return;

    const groupName = interaction.options.getString('group', true);
    const monitorIdStr = interaction.options.getString('monitor', true);
    const monitorId = parseInt(monitorIdStr, 10);

    const success = configStorage.addMonitorToGroup(groupName, monitorId);

    if (success) {
      const monitors = uptimeKuma.getAllMonitors();
      const monitorName = monitors.get(monitorId)?.name || `ID ${monitorId}`;

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Monitor Assigned')
        .setDescription(`**${monitorName}** → **${groupName}**`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({
        content: `❌ Failed to assign. Group **${groupName}** may not exist.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  private async unassignMonitor(
    interaction: ChatInputCommandInteraction,
    uptimeKuma: UptimeKumaService
  ): Promise<void> {
    if (!await this.checkAdmin(interaction)) return;

    const monitorIdStr = interaction.options.getString('monitor', true);
    const monitorId = parseInt(monitorIdStr, 10);

    const success = configStorage.removeMonitorFromGroup(monitorId);

    if (success) {
      const monitors = uptimeKuma.getAllMonitors();
      const monitorName = monitors.get(monitorId)?.name || `ID ${monitorId}`;

      const embed = new EmbedBuilder()
        .setColor(0xff9900)
        .setTitle('🗑️ Monitor Unassigned')
        .setDescription(`**${monitorName}** has been removed from its group.`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({
        content: `❌ This monitor was not assigned to any group.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  private async listGroups(
    interaction: ChatInputCommandInteraction,
    uptimeKuma: UptimeKumaService
  ): Promise<void> {
    if (!await this.checkAdmin(interaction)) return;

    const groups = configStorage.getGroups();

    if (groups.length === 0) {
      await interaction.reply({
        content: '📋 No groups created yet. Use `/group-add` to create one.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const monitors = uptimeKuma.getAllMonitors();
    const embed = new EmbedBuilder()
      .setColor(configStorage.getEmbedColor())
      .setTitle('📋 Monitor Groups')
      .setTimestamp();

    for (const group of groups) {
      const monitorNames = group.monitorIds
        .map(id => {
          const monitor = monitors.get(id);
          return monitor ? `• ${monitor.name}` : `• ID ${id} (not found)`;
        });

      const value = monitorNames.length > 0 
        ? monitorNames.join('\n')
        : '*No monitors assigned*';

      embed.addFields({
        name: `${group.name} (${group.monitorIds.length} monitors)`,
        value: value,
        inline: false,
      });
    }

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  private parseIds(idsString: string): number[] {
    return idsString
      .split(',')
      .map(id => parseInt(id.trim(), 10))
      .filter(id => !isNaN(id) && id > 0);
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  public getCommands(): Command[] {
    return Array.from(this.commands.values());
  }

  public getCommand(name: string): Command | undefined {
    return this.commands.get(name);
  }

  public async handleAutocomplete(
    interaction: AutocompleteInteraction,
    uptimeKuma: UptimeKumaService
  ): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);

    try {
      if (focusedOption.name === 'monitor') {
        await this.autocompleteMonitors(interaction, uptimeKuma, focusedOption.value as string);
      } else if (focusedOption.name === 'group') {
        await this.autocompleteGroups(interaction, focusedOption.value as string);
      }
    } catch (error: any) {
      this.logger.error(`Autocomplete error: ${error.message}`);
      await interaction.respond([]);
    }
  }

  private async autocompleteMonitors(
    interaction: AutocompleteInteraction,
    uptimeKuma: UptimeKumaService,
    query: string
  ): Promise<void> {
    const monitors = uptimeKuma.getAllMonitors();
    const lowerQuery = query.toLowerCase();

    const filtered = Array.from(monitors.entries())
      .filter(([id, monitor]) => 
        monitor.name.toLowerCase().includes(lowerQuery) ||
        id.toString().includes(query) ||
        query === ''
      )
      .slice(0, 25)
      .map(([id, monitor]) => ({
        name: `${monitor.name} (ID: ${id})`,
        value: id.toString(),
      }));

    await interaction.respond(filtered);
  }

  private async autocompleteGroups(
    interaction: AutocompleteInteraction,
    query: string
  ): Promise<void> {
    const groups = configStorage.getGroups();
    const lowerQuery = query.toLowerCase();

    const filtered = groups
      .filter(group => group.name.toLowerCase().includes(lowerQuery))
      .slice(0, 25)
      .map(group => ({
        name: `${group.name} (${group.monitorIds.length} monitors)`,
        value: group.name,
      }));

    if (filtered.length === 0 && groups.length > 0) {
      const allGroups = groups
        .slice(0, 25)
        .map(group => ({
          name: `${group.name} (${group.monitorIds.length} monitors)`,
          value: group.name,
        }));
      await interaction.respond(allGroups);
    } else {
      await interaction.respond(filtered);
    }
  }
}

