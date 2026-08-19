import { EventEmitter } from 'events';
import { config } from '../config/config';
import { Monitor, MonitorStats, HeartbeatStatus } from '../types/uptime-kuma';
import { Logger } from '../utils/logger';
import { isAtLeast } from '../utils/version';
import { IUptimeKumaService } from './uptime-kuma.service';

// API keys (needed to auth /metrics) were added in 1.21.0
const MIN_METRICS_VERSION = '1.21.0';
// monitor_uptime_ratio (24h uptime) was added in 2.1.0
const MIN_UPTIME_METRIC_VERSION = '2.1.0';

// Polls the /metrics endpoint and authenticates with an API key, so no
// username/password is needed. Data is pulled on an interval, not pushed.
export class MetricsUptimeKumaService extends EventEmitter implements IUptimeKumaService {
  private monitors: Map<number, MonitorStats> = new Map();
  private logger: Logger;
  private pollTimer: NodeJS.Timeout | null = null;
  private pollInterval: number;
  private connected = false;
  private metricsUrl: string;
  private authHeader: string;
  private serverVersion: string | null = null;
  private hasUptimeMetric = false;
  private compatibilityChecked = false;

  constructor() {
    super();
    this.logger = new Logger('UptimeKumaMetrics');
    this.pollInterval = config.bot.updateInterval;
    this.metricsUrl = this.buildMetricsUrl(config.uptimeKuma.url);
    // API key is sent as the basic-auth password, the username is ignored
    this.authHeader = 'Basic ' + Buffer.from(`:${config.uptimeKuma.apiKey}`).toString('base64');
  }

  private buildMetricsUrl(base: string): string {
    return `${base.replace(/\/+$/, '')}/metrics`;
  }

  public async connect(): Promise<void> {
    this.logger.info(`Polling Uptime Kuma metrics at ${this.metricsUrl}`);

    let firstPollOk = false;
    try {
      await this.poll();
      firstPollOk = true;
    } catch (error: any) {
      // bad api key should fail fast; transient errors we keep retrying
      if (error.fatal) {
        throw error;
      }
      this.logger.warn(`Initial metrics fetch failed, will keep retrying: ${error.message}`);
    }

    // only check the version once we actually have a response
    if (firstPollOk) {
      this.checkCompatibility();
    }

    this.startPolling();
  }

  // Runs once after the first poll. Refuses to start on versions without API key
  // support, and warns when the uptime metric is missing.
  private checkCompatibility(): void {
    if (this.compatibilityChecked) {
      return;
    }
    this.compatibilityChecked = true;

    // pre-1.21 servers have no API keys; they usually 401 before we get here, but
    // check anyway so the failure is clear
    if (this.serverVersion && !isAtLeast(this.serverVersion, MIN_METRICS_VERSION)) {
      this.connected = false;
      const fatal: any = new Error(
        `Uptime Kuma ${this.serverVersion} does not support API keys (requires >= ${MIN_METRICS_VERSION}); metrics mode cannot work. Use websocket mode or upgrade Uptime Kuma.`
      );
      fatal.fatal = true;
      throw fatal;
    }

    if (this.serverVersion) {
      this.logger.info(`Uptime Kuma server version: ${this.serverVersion}`);
    }

    // check the metric itself rather than the version - if it's missing, uptime won't show
    if (!this.hasUptimeMetric) {
      const who = this.serverVersion ? `Uptime Kuma ${this.serverVersion}` : 'This Uptime Kuma version';
      this.logger.warn(
        `${who} does not expose 'monitor_uptime_ratio', so 24h uptime will not be shown (requires Uptime Kuma >= ${MIN_UPTIME_METRIC_VERSION}). Status and ping still work.`
      );
    }
  }

  private startPolling(): void {
    if (this.pollTimer) {
      return;
    }
    this.pollTimer = setInterval(() => {
      this.poll().catch((error: any) => {
        this.logger.error(`Metrics poll failed: ${error.message}`);
      });
    }, this.pollInterval);
    this.logger.info(`Polling /metrics every ${this.pollInterval / 1000} seconds`);
  }

  private async poll(): Promise<void> {
    let response;
    try {
      response = await fetch(this.metricsUrl, {
        headers: { Authorization: this.authHeader, Accept: 'text/plain' },
      });
    } catch (error: any) {
      this.markDisconnected(error.message);
      throw new Error(`Network error fetching metrics: ${error.message}`);
    }

    if (response.status === 401 || response.status === 403) {
      this.markDisconnected(`HTTP ${response.status}`);
      const fatal: any = new Error(
        `Authentication failed (HTTP ${response.status}) - check UPTIME_KUMA_API_KEY`
      );
      fatal.fatal = true;
      throw fatal;
    }

    if (!response.ok) {
      this.markDisconnected(`HTTP ${response.status}`);
      throw new Error(`Unexpected response from /metrics: HTTP ${response.status}`);
    }

    const body = await response.text();
    this.parseMetrics(body);
    this.connected = true;
    this.emit('monitorsUpdated', this.getMonitorStats());
  }

  private markDisconnected(reason: string): void {
    if (this.connected) {
      this.emit('disconnected', reason);
    }
    this.connected = false;
  }

  // Parses the Prometheus text output and rebuilds the monitor map.
  // Ignores everything except the monitor gauges we use.
  private parseMetrics(body: string): void {
    const wanted = new Set(['monitor_status', 'monitor_response_time', 'monitor_uptime_ratio']);
    const acc = new Map<number, { monitor: Monitor; status?: number; ping?: number; uptime24h?: number }>();
    this.hasUptimeMetric = false;

    for (const rawLine of body.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) {
        continue;
      }

      const braceStart = line.indexOf('{');
      const braceEnd = line.lastIndexOf('}');
      if (braceStart === -1 || braceEnd === -1 || braceEnd < braceStart) {
        continue; // only labelled monitor metrics are relevant
      }

      const metricName = line.slice(0, braceStart).trim();

      if (metricName === 'app_version') {
        const version = this.parseLabels(line.slice(braceStart + 1, braceEnd))['version'];
        if (version) {
          this.serverVersion = version;
        }
        continue;
      }

      if (!wanted.has(metricName)) {
        continue;
      }

      const labels = this.parseLabels(line.slice(braceStart + 1, braceEnd));
      const idStr = labels['monitor_id'];
      if (!idStr) {
        continue;
      }
      const id = parseInt(idStr, 10);
      if (Number.isNaN(id)) {
        continue;
      }

      const value = parseFloat(line.slice(braceEnd + 1).trim());
      if (Number.isNaN(value)) {
        continue;
      }

      let entry = acc.get(id);
      if (!entry) {
        entry = {
          monitor: {
            id,
            name: labels['monitor_name'] || `Monitor ${id}`,
            type: labels['monitor_type'] || 'unknown',
            url: labels['monitor_url'] || undefined,
            active: true,
            interval: 0,
          },
        };
        acc.set(id, entry);
      } else {
        if (labels['monitor_name']) entry.monitor.name = labels['monitor_name'];
        if (labels['monitor_type']) entry.monitor.type = labels['monitor_type'];
        if (labels['monitor_url']) entry.monitor.url = labels['monitor_url'];
      }

      if (metricName === 'monitor_status') {
        entry.status = value;
      } else if (metricName === 'monitor_response_time') {
        entry.ping = value;
      } else if (metricName === 'monitor_uptime_ratio' && labels['window'] === '1d') {
        entry.uptime24h = value * 100;
        this.hasUptimeMetric = true;
      }
    }

    const next = new Map<number, MonitorStats>();
    for (const [id, entry] of acc) {
      const currentStatus: HeartbeatStatus = (entry.status ?? HeartbeatStatus.PENDING) as HeartbeatStatus;
      const previous = this.monitors.get(id);

      next.set(id, {
        monitor: entry.monitor,
        currentStatus,
        // /metrics reports -1 for response time when a monitor is down or has no data.
        avgPing: entry.ping !== undefined && entry.ping >= 0 ? entry.ping : undefined,
        uptime24h: entry.uptime24h,
        lastHeartbeat: previous?.lastHeartbeat,
      });

      if (previous && previous.currentStatus !== currentStatus) {
        this.logger.info(
          `Monitor ${entry.monitor.name} status changed: ${HeartbeatStatus[previous.currentStatus]} -> ${HeartbeatStatus[currentStatus]}`
        );
        this.emit('statusChanged', next.get(id));
      }
    }

    this.monitors = next;
  }

  private parseLabels(block: string): Record<string, string> {
    const labels: Record<string, string> = {};
    const re = /([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(block)) !== null) {
      labels[match[1]] = match[2];
    }
    return labels;
  }

  public getAllMonitors(): Map<number, Monitor> {
    const all = new Map<number, Monitor>();
    for (const [id, stats] of this.monitors.entries()) {
      all.set(id, stats.monitor);
    }
    return all;
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
    return this.connected;
  }

  public async forceReconnect(): Promise<void> {
    this.logger.info('Forcing metrics refresh...');
    await this.poll();
  }

  public disconnect(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.connected = false;
    this.logger.info('Stopped polling Uptime Kuma /metrics');
  }
}
