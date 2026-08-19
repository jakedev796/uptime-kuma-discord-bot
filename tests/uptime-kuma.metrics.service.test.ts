import { MetricsUptimeKumaService } from '../src/services/uptime-kuma.metrics.service';
import { HeartbeatStatus } from '../src/types/uptime-kuma';

jest.mock('../src/config/config', () => ({
  config: {
    uptimeKuma: {
      mode: 'metrics',
      url: 'http://localhost:3001/',
      username: '',
      password: '',
      apiKey: 'uk1_testkey',
    },
    bot: {
      updateInterval: 60000,
      embedColor: 0,
    },
  },
}));

jest.mock('../src/utils/logger');

const SAMPLE = `# HELP monitor_status Monitor Status (1 = UP, 0= DOWN, 2= PENDING, 3= MAINTENANCE)
# TYPE monitor_status gauge
monitor_status{sometag="",monitor_id="3",monitor_name="instalace-hajek.cz",monitor_type="http",monitor_url="https://instalace-hajek.cz"} 1
monitor_status{monitor_id="1",monitor_name="davidbubenik.cz",monitor_type="http",monitor_url="https://davidbubenik.cz"} 0
# TYPE monitor_response_time gauge
monitor_response_time{monitor_id="3",monitor_name="instalace-hajek.cz",monitor_type="http"} 155
monitor_response_time{monitor_id="1",monitor_name="davidbubenik.cz",monitor_type="http"} -1
# TYPE monitor_uptime_ratio gauge
monitor_uptime_ratio{monitor_id="3",monitor_name="instalace-hajek.cz",window="1d"} 0.9972222
monitor_uptime_ratio{monitor_id="3",monitor_name="instalace-hajek.cz",window="30d"} 0.95
monitor_uptime_ratio{monitor_id="1",monitor_name="davidbubenik.cz",window="1d"} 0
process_cpu_seconds_total 247.88
`;

function mockFetch(impl: () => any): void {
  (global as any).fetch = jest.fn().mockImplementation(async () => impl());
}

describe('MetricsUptimeKumaService', () => {
  let service: MetricsUptimeKumaService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MetricsUptimeKumaService();
  });

  afterEach(() => {
    service.disconnect();
    delete (global as any).fetch;
  });

  describe('parseMetrics', () => {
    beforeEach(() => {
      (service as any).parseMetrics(SAMPLE);
    });

    test('builds one MonitorStats per monitor_id, sorted by name', () => {
      const stats = service.getMonitorStats();
      expect(stats.map(s => s.monitor.id)).toEqual([1, 3]); // davidbubenik before instalace-hajek
    });

    test('maps monitor_status to HeartbeatStatus', () => {
      const byId = new Map(service.getMonitorStats().map(s => [s.monitor.id, s]));
      expect(byId.get(3)!.currentStatus).toBe(HeartbeatStatus.UP);
      expect(byId.get(1)!.currentStatus).toBe(HeartbeatStatus.DOWN);
    });

    test('uses the 1d window for uptime24h and ignores other windows', () => {
      const byId = new Map(service.getMonitorStats().map(s => [s.monitor.id, s]));
      expect(byId.get(3)!.uptime24h).toBeCloseTo(99.72222, 4);
      expect(byId.get(1)!.uptime24h).toBe(0);
    });

    test('treats -1 response time as no ping', () => {
      const byId = new Map(service.getMonitorStats().map(s => [s.monitor.id, s]));
      expect(byId.get(3)!.avgPing).toBe(155);
      expect(byId.get(1)!.avgPing).toBeUndefined();
    });

    test('exposes monitor metadata from labels', () => {
      const monitors = service.getAllMonitors();
      expect(monitors.get(3)!.name).toBe('instalace-hajek.cz');
      expect(monitors.get(3)!.type).toBe('http');
      expect(monitors.get(3)!.url).toBe('https://instalace-hajek.cz');
    });
  });

  describe('connect', () => {
    test('fetches, marks connected, and emits monitorsUpdated on success', async () => {
      mockFetch(() => ({ ok: true, status: 200, text: async () => SAMPLE }));
      const updated = jest.fn();
      service.on('monitorsUpdated', updated);

      await service.connect();

      expect(service.isConnected()).toBe(true);
      expect(updated).toHaveBeenCalled();
      expect(service.getMonitorStats()).toHaveLength(2);
      // builds /metrics URL from base, collapsing the trailing slash
      expect((global as any).fetch).toHaveBeenCalledWith(
        'http://localhost:3001/metrics',
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: expect.stringMatching(/^Basic /) }) })
      );
    });

    test('throws on auth failure (401) and stays disconnected', async () => {
      mockFetch(() => ({ ok: false, status: 401, text: async () => '' }));

      await expect(service.connect()).rejects.toThrow('Authentication failed');
      expect(service.isConnected()).toBe(false);
    });

    test('tolerates a transient network error and keeps the bot running', async () => {
      mockFetch(() => { throw new Error('ECONNREFUSED'); });

      await expect(service.connect()).resolves.toBeUndefined();
      expect(service.isConnected()).toBe(false);
    });
  });

  describe('version compatibility', () => {
    const STATUS_ONLY = (version?: string) =>
      `${version ? `app_version{version="${version}"} 1\n` : ''}` +
      `monitor_status{monitor_id="1",monitor_name="x",monitor_type="http"} 1\n` +
      `monitor_response_time{monitor_id="1",monitor_name="x",monitor_type="http"} 50\n`;

    test('hard-fails below 1.21.0 (no API key support) and stays disconnected', async () => {
      mockFetch(() => ({ ok: true, status: 200, text: async () => STATUS_ONLY('1.20.0') }));

      await expect(service.connect()).rejects.toThrow(/1\.21\.0/);
      expect(service.isConnected()).toBe(false);
    });

    test('warns but runs when monitor_uptime_ratio is absent (< 2.1.0)', async () => {
      mockFetch(() => ({ ok: true, status: 200, text: async () => STATUS_ONLY('2.0.0') }));

      await service.connect();

      expect(service.isConnected()).toBe(true);
      expect((service as any).logger.warn).toHaveBeenCalledWith(expect.stringContaining('uptime'));
    });

    test('does not warn about uptime when monitor_uptime_ratio is present', async () => {
      mockFetch(() => ({ ok: true, status: 200, text: async () => SAMPLE }));

      await service.connect();

      expect(service.isConnected()).toBe(true);
      const warned = ((service as any).logger.warn as jest.Mock).mock.calls.flat().join(' ');
      expect(warned).not.toContain('uptime');
    });

    test('detects and stores the server version from app_version', async () => {
      mockFetch(() => ({ ok: true, status: 200, text: async () => `app_version{version="2.3.2"} 1\n${SAMPLE}` }));

      await service.connect();

      expect((service as any).serverVersion).toBe('2.3.2');
      expect(service.isConnected()).toBe(true);
    });
  });
});
