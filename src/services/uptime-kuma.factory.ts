import { config } from '../config/config';
import { Logger } from '../utils/logger';
import { IUptimeKumaService, UptimeKumaService } from './uptime-kuma.service';
import { MetricsUptimeKumaService } from './uptime-kuma.metrics.service';

// Builds the Uptime Kuma source based on UPTIME_KUMA_MODE (websocket or metrics).
export function createUptimeKumaService(): IUptimeKumaService {
  const logger = new Logger('UptimeKumaFactory');

  if (config.uptimeKuma.mode === 'metrics') {
    logger.info('Uptime Kuma data source: metrics (API key)');
    return new MetricsUptimeKumaService();
  }

  logger.info('Uptime Kuma data source: websocket (username/password)');
  return new UptimeKumaService();
}
