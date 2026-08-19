import { UptimeKumaService } from '../src/services/uptime-kuma.service';

// Mock socket.io-client
jest.mock('socket.io-client', () => ({
  io: jest.fn().mockImplementation(() => ({
    connected: false,
    connect: jest.fn(),
    disconnect: jest.fn(),
    on: jest.fn(),
    emit: jest.fn(),
  })),
}));

// Mock other dependencies
jest.mock('../src/config/config');
jest.mock('../src/utils/logger');

describe('UptimeKumaService', () => {
  let uptimeKumaService: UptimeKumaService;

  beforeEach(() => {
    jest.clearAllMocks();
    uptimeKumaService = new UptimeKumaService();
  });

  test('should create service instance', () => {
    expect(uptimeKumaService).toBeDefined();
  });

  test('should return connection status', () => {
    // Initially should be disconnected
    expect(uptimeKumaService.isConnected()).toBe(false);
  });

  test('should handle connection state changes', () => {
    // Mock socket connection
    const mockSocket = {
      connected: true,
      connect: jest.fn(),
      disconnect: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
    };

    // Simulate connection by mocking the socket property and authentication
    (uptimeKumaService as any).socket = mockSocket;
    (uptimeKumaService as any).isAuthenticated = true;

    expect(uptimeKumaService.isConnected()).toBe(true);

    // Simulate disconnection
    mockSocket.connected = false;
    expect(uptimeKumaService.isConnected()).toBe(false);
  });

  test('should handle force reconnect', async () => {
    // Mock the connect method to avoid socket.once issues
    const mockConnect = jest.fn().mockResolvedValue(undefined);
    (uptimeKumaService as any).connect = mockConnect;
    
    // Should not throw error even when not connected
    await expect(uptimeKumaService.forceReconnect()).resolves.not.toThrow();
    expect(mockConnect).toHaveBeenCalled();
  });

  test('should handle disconnect', () => {
    // Should not throw error
    expect(() => uptimeKumaService.disconnect()).not.toThrow();
  });

  test('should get monitor stats', () => {
    const stats = uptimeKumaService.getMonitorStats();
    expect(stats).toBeDefined();
    expect(Array.isArray(stats)).toBe(true);
  });

  test('parses positional avgPing/uptime events and scales uptime to a percentage', () => {
    // these come as positional args (id, period, ratio), not an object
    const handlers: Record<string, (...args: any[]) => void> = {};
    const mockSocket = {
      connected: true,
      on: jest.fn((event: string, cb: (...args: any[]) => void) => { handlers[event] = cb; }),
      once: jest.fn(),
      emit: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
    };
    (uptimeKumaService as any).socket = mockSocket;
    (uptimeKumaService as any).setupSocketListeners();

    (uptimeKumaService as any).monitors.set(1, {
      monitor: { id: 1, name: 'Test', type: 'http', active: true, interval: 60 },
      currentStatus: 1,
    });

    handlers['avgPing'](1, 123);
    handlers['uptime'](1, 24, 0.9972);   // 24h window -> tracked
    handlers['uptime'](1, 720, 0.5);     // 30d window -> ignored
    handlers['uptime'](1, '1y', 0.4);    // 1y window  -> ignored

    const stats = uptimeKumaService.getMonitorStats().find(s => s.monitor.id === 1)!;
    expect(stats.avgPing).toBe(123);
    expect(stats.uptime24h).toBeCloseTo(99.72, 2);
  });
});
