import { config } from './config/config';
import { configStorage } from './config/storage';
import { UptimeKumaService } from './services/uptime-kuma.service';
import { DiscordService } from './services/discord.service';
import { Logger } from './utils/logger';

class UptimeKumaDiscordBot {
  private uptimeKuma: UptimeKumaService;
  private discord: DiscordService;
  private updateInterval: NodeJS.Timeout | null = null;
  private logger: Logger;
  private isShuttingDown = false;

  constructor() {
    this.uptimeKuma = new UptimeKumaService();
    this.discord = new DiscordService();
    this.discord.setUptimeKumaService(this.uptimeKuma);
    this.logger = new Logger('Bot');
    this.setupSignalHandlers();
  }

  private setupSignalHandlers(): void {
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
    
    signals.forEach(signal => {
      process.on(signal, () => {
        this.logger.info(`Received ${signal}, shutting down gracefully...`);
        this.shutdown();
      });
    });

    process.on('uncaughtException', (error: Error) => {
      this.logger.error(`Uncaught Exception: ${error.message}`);
      this.logger.error(error.stack || '');
      this.shutdown();
    });

    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      this.logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
      this.shutdown();
    });
  }

  public async start(): Promise<void> {
    try {
      this.logger.info('Starting Uptime Kuma Discord Bot...');
      
      this.logger.info('Connecting to Discord...');
      await this.discord.connect();
      
      this.logger.info('Connecting to Uptime Kuma...');
      await this.uptimeKuma.connect();
      
      this.setupEventListeners();
      
      this.startUpdateInterval();
      
      this.logger.info('Bot started successfully!');
    } catch (error: any) {
      this.logger.error(`Failed to start bot: ${error.message}`);
      this.logger.error(error.stack || '');
      process.exit(1);
    }
  }

  private setupEventListeners(): void {
    this.uptimeKuma.on('monitorsUpdated', (monitors: any) => {
      this.discord.updateMonitorStatus(monitors).catch((error: Error) => {
        this.logger.error(`Failed to update Discord status: ${error.message}`);
      });
    });

    this.uptimeKuma.on('statusChanged', (stats: any) => {
      this.logger.info(`Monitor status changed: ${stats.monitor.name} is now ${stats.currentStatus}`);
    });

    this.uptimeKuma.on('disconnected', (reason: string) => {
      this.logger.warn(`Uptime Kuma disconnected: ${reason}`);
      if (reason === 'io server disconnect') {
        this.logger.info('Attempting to reconnect...');
      }
    });
  }

  private startUpdateInterval(): void {
    const updateFn = () => {
      if (!this.uptimeKuma.isConnected()) {
        this.logger.warn('Uptime Kuma is not connected, skipping update');
        return;
      }

      const trackedIds = configStorage.getMonitorIds();
      const monitors = this.uptimeKuma.getMonitorStats(trackedIds);
      this.discord.updateMonitorStatus(monitors).catch(error => {
        this.logger.error(`Failed to update Discord status: ${error.message}`);
      });
    };

    const interval = configStorage.getUpdateInterval();
    this.updateInterval = setInterval(updateFn, interval);

    this.logger.info(`Update interval set to ${interval / 1000} seconds`);
    
    const trackedIds = configStorage.getMonitorIds();
    if (trackedIds.length > 0) {
      this.logger.info(`Tracking ${trackedIds.length} specific monitor(s): ${trackedIds.join(', ')}`);
    } else {
      this.logger.info('Tracking all monitors');
    }
  }

  private async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;

    try {
      this.logger.info('Shutting down...');

      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }

      this.uptimeKuma.disconnect();
      this.discord.disconnect();

      this.logger.info('Shutdown complete');
      process.exit(0);
    } catch (error: any) {
      this.logger.error(`Error during shutdown: ${error.message}`);
      process.exit(1);
    }
  }
}

const bot = new UptimeKumaDiscordBot();
bot.start();

