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
});
