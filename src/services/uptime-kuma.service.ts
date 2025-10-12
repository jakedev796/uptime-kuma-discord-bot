import { io, Socket } from 'socket.io-client';
import { EventEmitter } from 'events';
import { config } from '../config/config';
import { Monitor, Heartbeat, MonitorStats, HeartbeatStatus, UptimeKumaResponse } from '../types/uptime-kuma';
import { Logger } from '../utils/logger';

export class UptimeKumaService extends EventEmitter {
  private socket: Socket | null = null;
  private monitors: Map<number, MonitorStats> = new Map();
  private reconnectAttempts = 0;
  private reconnectDelay = 5000;
  private isAuthenticated = false;
  private logger: Logger;
  private manualReconnectTimeout: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.logger = new Logger('UptimeKumaService');
  }

  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.logger.info(`Connecting to Uptime Kuma at ${config.uptimeKuma.url}`);
        
        this.socket = io(config.uptimeKuma.url, {
          reconnection: true,
          reconnectionDelay: this.reconnectDelay,
          reconnectionAttempts: Infinity,
          transports: ['websocket', 'polling'],
        });

        this.setupSocketListeners();

        this.socket.once('connect', () => {
          this.logger.info('Connected to Uptime Kuma, attempting authentication...');
          this.authenticate()
            .then(() => {
              this.reconnectAttempts = 0;
              resolve();
            })
            .catch(reject);
        });

        this.socket.once('connect_error', (error) => {
          this.logger.error(`Connection error: ${error.message}`);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private setupSocketListeners(): void {
    if (!this.socket) return;

    this.socket.on('disconnect', (reason) => {
      this.logger.warn(`Disconnected from Uptime Kuma: ${reason}`);
      this.isAuthenticated = false;
      this.emit('disconnected', reason);
      
      // Manual reconnection fallback after 30 seconds of being disconnected
      if (this.manualReconnectTimeout) {
        clearTimeout(this.manualReconnectTimeout);
      }
      this.manualReconnectTimeout = setTimeout(() => {
        if (!this.isConnected() && this.socket) {
          this.logger.info('Attempting manual reconnection...');
          this.socket.connect();
        }
      }, 30000);
    });

    this.socket.on('connect', () => {
      // Clear manual reconnection timeout since we're connected
      if (this.manualReconnectTimeout) {
        clearTimeout(this.manualReconnectTimeout);
        this.manualReconnectTimeout = null;
      }

      if (this.reconnectAttempts > 0) {
        this.logger.info('Reconnected to Uptime Kuma, re-authenticating...');
        this.reconnectAttempts = 0;
        this.authenticate().catch(err => {
          this.logger.error(`Re-authentication failed: ${err.message}`);
        });
      }
    });

    this.socket.on('monitorList', (data: Record<string, Monitor>) => {
      this.handleMonitorList(data);
    });

    this.socket.on('heartbeat', (heartbeat: Heartbeat) => {
      this.handleHeartbeat(heartbeat);
    });

    this.socket.on('avgPing', (data: { monitorID: number; avgPing: number | null }) => {
      this.handleAvgPing(data.monitorID, data.avgPing);
    });

    this.socket.on('uptime', (data: { monitorID: number; periodKey: string; percentage: number }) => {
      if (data.periodKey === '24') {
        this.handleUptime(data.monitorID, data.percentage);
      }
    });

    this.socket.on('connect_error', (error) => {
      this.reconnectAttempts++;
      this.logger.error(`Socket.io connection error (attempt ${this.reconnectAttempts}): ${error.message}`);
    });

    this.socket.on('error', (error) => {
      this.logger.error(`Socket.io error: ${error}`);
    });
  }

  private async authenticate(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        return reject(new Error('Socket not connected'));
      }

      const timeout = setTimeout(() => {
        reject(new Error('Authentication timeout'));
      }, 10000);

      this.logger.info('Authenticating with Uptime Kuma...');
      this.socket.emit(
        'login',
        {
          username: config.uptimeKuma.username,
          password: config.uptimeKuma.password,
          token: '',
        },
        (response: UptimeKumaResponse) => {
          clearTimeout(timeout);
          
          if (response.ok) {
            this.isAuthenticated = true;
            this.logger.info('Successfully authenticated with Uptime Kuma');
            resolve();
          } else {
            const errorMsg = response.msg || 'Authentication failed';
            this.logger.error(`Authentication failed: ${errorMsg}`);
            reject(new Error(errorMsg));
          }
        }
      );
    });
  }

  public getAllMonitors(): Map<number, Monitor> {
    const allMonitors = new Map<number, Monitor>();
    for (const [id, stats] of this.monitors.entries()) {
      allMonitors.set(id, stats.monitor);
    }
    return allMonitors;
  }

  private handleMonitorList(data: Record<string, Monitor>, filterByIds?: number[]): void {
    this.logger.info(`Received monitor list with ${Object.keys(data).length} monitors`);
    
    for (const [id, monitor] of Object.entries(data)) {
      const monitorId = parseInt(id, 10);
      const existing = this.monitors.get(monitorId);
      
      this.monitors.set(monitorId, {
        monitor,
        currentStatus: existing?.currentStatus || HeartbeatStatus.PENDING,
        lastHeartbeat: existing?.lastHeartbeat,
        avgPing: existing?.avgPing,
        uptime24h: existing?.uptime24h,
      });
    }

    this.emit('monitorsUpdated', this.getMonitorStats());
  }

  private handleHeartbeat(heartbeat: Heartbeat): void {
    if (!this.shouldTrackMonitor(heartbeat.monitorID)) {
      return;
    }

    const stats = this.monitors.get(heartbeat.monitorID);
    if (stats) {
      const oldStatus = stats.currentStatus;
      stats.currentStatus = heartbeat.status;
      stats.lastHeartbeat = heartbeat;

      if (oldStatus !== heartbeat.status && heartbeat.important) {
        this.logger.info(`Monitor ${stats.monitor.name} status changed: ${HeartbeatStatus[oldStatus]} -> ${HeartbeatStatus[heartbeat.status]}`);
        this.emit('statusChanged', stats);
      }

      this.emit('monitorsUpdated', this.getMonitorStats());
    }
  }

  private handleAvgPing(monitorID: number, avgPing: number | null): void {
    if (!this.shouldTrackMonitor(monitorID)) {
      return;
    }

    const stats = this.monitors.get(monitorID);
    if (stats) {
      stats.avgPing = avgPing || undefined;
    }
  }

  private handleUptime(monitorID: number, percentage: number): void {
    if (!this.shouldTrackMonitor(monitorID)) {
      return;
    }

    const stats = this.monitors.get(monitorID);
    if (stats) {
      stats.uptime24h = percentage;
    }
  }

  public setMonitorIds(ids: number[]): void {
    const oldIds = Array.from(this.monitors.keys());
    const newIds = ids.length === 0 ? oldIds : ids;

    for (const id of oldIds) {
      if (!newIds.includes(id)) {
        this.monitors.delete(id);
      }
    }

    this.emit('monitorsUpdated', this.getMonitorStats());
  }

  private shouldTrackMonitor(monitorId: number, monitorIds?: number[]): boolean {
    const ids = monitorIds || this.getCurrentMonitorIds();
    if (ids.length === 0) {
      return true;
    }
    return ids.includes(monitorId);
  }

  private getCurrentMonitorIds(): number[] {
    return [];
  }

  public getMonitorStats(filterIds?: number[]): MonitorStats[] {
    const stats = Array.from(this.monitors.values());
    
    if (!filterIds || filterIds.length === 0) {
      return stats.sort((a, b) => a.monitor.name.localeCompare(b.monitor.name));
    }

    return stats
      .filter(s => filterIds.includes(s.monitor.id))
      .sort((a, b) => a.monitor.name.localeCompare(b.monitor.name));
  }

  public isConnected(): boolean {
    return this.socket !== null && this.socket.connected && this.isAuthenticated;
  }

  public disconnect(): void {
    if (this.manualReconnectTimeout) {
      clearTimeout(this.manualReconnectTimeout);
      this.manualReconnectTimeout = null;
    }

    if (this.socket) {
      this.logger.info('Disconnecting from Uptime Kuma');
      this.socket.disconnect();
      this.socket = null;
      this.isAuthenticated = false;
    }
  }
}

