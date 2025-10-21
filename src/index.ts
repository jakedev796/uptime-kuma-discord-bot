import { config } from './config/config';
import { configStorage } from './config/storage';
import { UptimeKumaService } from './services/uptime-kuma.service';
import { DiscordService } from './services/discord.service';
import { Logger } from './utils/logger';
import { MonitorStats } from './types/uptime-kuma';
import * as http from 'http';

class UptimeKumaDiscordBot {
  private uptimeKuma: UptimeKumaService;
  private discord: DiscordService;
  private updateInterval: NodeJS.Timeout | null = null;
  private logger: Logger;
  private isShuttingDown = false;
  private healthServer: http.Server | null = null;

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
      
      this.startHealthServer();
      
      this.logger.info('Bot started successfully!');
    } catch (error: any) {
      this.logger.error(`Failed to start bot: ${error.message}`);
      this.logger.error(error.stack || '');
      process.exit(1);
    }
  }

  private setupEventListeners(): void {
    this.uptimeKuma.on('monitorsUpdated', (monitors: MonitorStats[]) => {
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
    let consecutiveDisconnections = 0;
    const maxConsecutiveDisconnections = 5;

    const updateFn = async () => {
      if (!this.uptimeKuma.isConnected()) {
        this.logger.warn('Uptime Kuma is not connected, skipping update');
        consecutiveDisconnections++;
        
        // If we've been disconnected for too long, try a force reconnect
        if (consecutiveDisconnections >= maxConsecutiveDisconnections) {
          this.logger.warn(`Uptime Kuma has been disconnected for ${consecutiveDisconnections} consecutive checks, attempting force reconnect...`);
          try {
            await this.uptimeKuma.forceReconnect();
            consecutiveDisconnections = 0;
            this.logger.info('Force reconnect successful');
          } catch (error: any) {
            this.logger.error(`Force reconnect failed: ${error.message}`);
          }
        }
        return;
      }

      // Reset counter on successful connection
      if (consecutiveDisconnections > 0) {
        consecutiveDisconnections = 0;
      }

      const monitors = this.uptimeKuma.getMonitorStats();
      this.discord.updateMonitorStatus(monitors).catch(error => {
        this.logger.error(`Failed to update Discord status: ${error.message}`);
      });
    };

    const defaultInterval = config.bot.updateInterval;
    this.updateInterval = setInterval(updateFn, defaultInterval);

    this.logger.info(`Update interval set to ${defaultInterval / 1000} seconds`);
    
    const guildIds = configStorage.getAllGuildIds();
    if (guildIds.length > 0) {
      this.logger.info(`Configured for ${guildIds.length} guild(s)`);
    } else {
      this.logger.info('No guilds configured yet. Use /set-channel in a Discord server to get started.');
    }
  }

  private startHealthServer(): void {
    const port = parseInt(process.env.HEALTH_PORT || '3000', 10);
    
    this.healthServer = http.createServer((req, res) => {
      if (req.url === '/health' && req.method === 'GET') {
        const isHealthy = this.discord.isConnected() && this.uptimeKuma.isConnected();
        const status = isHealthy ? 'healthy' : 'unhealthy';
        const statusCode = isHealthy ? 200 : 503;
        
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status,
          discord: this.discord.isConnected() ? 'connected' : 'disconnected',
          uptimeKuma: this.uptimeKuma.isConnected() ? 'connected' : 'disconnected',
          timestamp: new Date().toISOString()
        }));
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });

    this.healthServer.listen(port, '0.0.0.0', () => {
      this.logger.info(`Health check server listening on port ${port}`);
    });

    this.healthServer.on('error', (error: any) => {
      this.logger.error(`Health server error: ${error.message}`);
    });
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

      if (this.healthServer) {
        this.healthServer.close();
        this.healthServer = null;
      }

      this.uptimeKuma.disconnect();
      this.discord.disconnect();

      // Flush any pending config saves
      configStorage.flush();

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

