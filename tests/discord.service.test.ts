import { DiscordService } from '../src/services/discord.service';
import { Client } from 'discord.js';

// Mock discord.js
jest.mock('discord.js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    isReady: jest.fn(),
    login: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    destroy: jest.fn(),
  })),
  GatewayIntentBits: {
    Guilds: 'GUILDS',
  },
}));

// Mock other dependencies
jest.mock('../src/config/config');
jest.mock('../src/config/storage');
jest.mock('../src/services/commands.service');
jest.mock('../src/services/uptime-kuma.service');

describe('DiscordService', () => {
  let discordService: DiscordService;
  let mockClient: jest.Mocked<Client>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get the mocked client instance
    mockClient = new Client({ intents: [] }) as jest.Mocked<Client>;
    
    discordService = new DiscordService();
  });

  test('should create Discord client with correct intents', () => {
    expect(Client).toHaveBeenCalledWith({
      intents: ['GUILDS'],
    });
  });

  test('should return client instance', () => {
    const client = discordService.getClient();
    expect(client).toBeDefined();
  });

  test('should return connection status', () => {
    // Get the actual client from the service
    const client = discordService.getClient();
    
    // Test when client is ready
    (client as any).isReady = jest.fn().mockReturnValue(true);
    expect(discordService.isConnected()).toBe(true);

    // Test when client is not ready
    (client as any).isReady = jest.fn().mockReturnValue(false);
    expect(discordService.isConnected()).toBe(false);
  });

  test('should set uptime kuma service', () => {
    const mockUptimeKumaService = {} as any;
    
    expect(() => {
      discordService.setUptimeKumaService(mockUptimeKumaService);
    }).not.toThrow();
  });
});
