import { ConfigManager } from '../src/config/config';

describe('ConfigManager', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Clear environment variables
    delete process.env.DISCORD_BOT_TOKEN;
    delete process.env.UPTIME_KUMA_URL;
    delete process.env.UPTIME_KUMA_USERNAME;
    delete process.env.UPTIME_KUMA_PASSWORD;
    delete process.env.ADMIN_USER_IDS;
    delete process.env.UPDATE_INTERVAL;
    delete process.env.EMBED_COLOR;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  test('should load valid configuration', () => {
    process.env.DISCORD_BOT_TOKEN = 'test-token';
    process.env.UPTIME_KUMA_URL = 'http://localhost:3001';
    process.env.UPTIME_KUMA_USERNAME = 'test-user';
    process.env.UPTIME_KUMA_PASSWORD = 'test-password';
    process.env.ADMIN_USER_IDS = '123456789,987654321';
    process.env.UPDATE_INTERVAL = '30';
    process.env.EMBED_COLOR = '16711680';

    const configManager = new ConfigManager();
    const config = configManager.getConfig();

    expect(config.discord.token).toBe('test-token');
    expect(config.discord.adminUserIds).toEqual(['123456789', '987654321']);
    expect(config.uptimeKuma.url).toBe('http://localhost:3001');
    expect(config.uptimeKuma.username).toBe('test-user');
    expect(config.uptimeKuma.password).toBe('test-password');
    expect(config.bot.updateInterval).toBe(30000); // 30 * 1000
    expect(config.bot.embedColor).toBe(16711680);
  });

  test('should use default values when environment variables are not set', () => {
    process.env.DISCORD_BOT_TOKEN = 'test-token';
    process.env.UPTIME_KUMA_URL = 'http://localhost:3001';
    process.env.UPTIME_KUMA_USERNAME = 'test-user';
    process.env.UPTIME_KUMA_PASSWORD = 'test-password';

    const configManager = new ConfigManager();
    const config = configManager.getConfig();

    expect(config.discord.adminUserIds).toEqual([]);
    expect(config.bot.updateInterval).toBe(60000); // 60 * 1000 (default)
    expect(config.bot.embedColor).toBe(5814783); // default color
  });

  test('should parse admin user IDs correctly', () => {
    process.env.DISCORD_BOT_TOKEN = 'test-token';
    process.env.UPTIME_KUMA_URL = 'http://localhost:3001';
    process.env.UPTIME_KUMA_USERNAME = 'test-user';
    process.env.UPTIME_KUMA_PASSWORD = 'test-password';
    process.env.ADMIN_USER_IDS = '123456789, 987654321 , 555666777 ';

    const configManager = new ConfigManager();
    const config = configManager.getConfig();

    expect(config.discord.adminUserIds).toEqual(['123456789', '987654321', '555666777']);
  });

  test('should handle empty admin user IDs', () => {
    process.env.DISCORD_BOT_TOKEN = 'test-token';
    process.env.UPTIME_KUMA_URL = 'http://localhost:3001';
    process.env.UPTIME_KUMA_USERNAME = 'test-user';
    process.env.UPTIME_KUMA_PASSWORD = 'test-password';
    process.env.ADMIN_USER_IDS = '';

    const configManager = new ConfigManager();
    const config = configManager.getConfig();

    expect(config.discord.adminUserIds).toEqual([]);
  });

  test('should throw error when DISCORD_BOT_TOKEN is missing', () => {
    process.env.UPTIME_KUMA_URL = 'http://localhost:3001';
    process.env.UPTIME_KUMA_USERNAME = 'test-user';
    process.env.UPTIME_KUMA_PASSWORD = 'test-password';

    expect(() => new ConfigManager()).toThrow('DISCORD_BOT_TOKEN is required');
  });

  test('should throw error when UPTIME_KUMA_URL is empty', () => {
    process.env.DISCORD_BOT_TOKEN = 'test-token';
    process.env.UPTIME_KUMA_URL = '';
    process.env.UPTIME_KUMA_USERNAME = 'test-user';
    process.env.UPTIME_KUMA_PASSWORD = 'test-password';

    expect(() => new ConfigManager()).toThrow('UPTIME_KUMA_URL is required');
  });

  test('should throw error when UPTIME_KUMA_USERNAME is missing', () => {
    process.env.DISCORD_BOT_TOKEN = 'test-token';
    process.env.UPTIME_KUMA_URL = 'http://localhost:3001';
    process.env.UPTIME_KUMA_PASSWORD = 'test-password';

    expect(() => new ConfigManager()).toThrow('UPTIME_KUMA_USERNAME is required');
  });

  test('should throw error when UPTIME_KUMA_PASSWORD is missing', () => {
    process.env.DISCORD_BOT_TOKEN = 'test-token';
    process.env.UPTIME_KUMA_URL = 'http://localhost:3001';
    process.env.UPTIME_KUMA_USERNAME = 'test-user';

    expect(() => new ConfigManager()).toThrow('UPTIME_KUMA_PASSWORD is required');
  });

  test('should throw error when UPDATE_INTERVAL is too low', () => {
    process.env.DISCORD_BOT_TOKEN = 'test-token';
    process.env.UPTIME_KUMA_URL = 'http://localhost:3001';
    process.env.UPTIME_KUMA_USERNAME = 'test-user';
    process.env.UPTIME_KUMA_PASSWORD = 'test-password';
    process.env.UPDATE_INTERVAL = '5'; // Less than 10 seconds

    expect(() => new ConfigManager()).toThrow('UPDATE_INTERVAL must be at least 10 seconds');
  });

  test('should throw error with multiple validation failures', () => {
    // Missing multiple required fields
    process.env.DISCORD_BOT_TOKEN = 'test-token';
    process.env.UPTIME_KUMA_URL = '';
    // Missing UPTIME_KUMA_USERNAME, UPTIME_KUMA_PASSWORD

    expect(() => new ConfigManager()).toThrow('Configuration validation failed:');
    expect(() => new ConfigManager()).toThrow('UPTIME_KUMA_URL is required');
    expect(() => new ConfigManager()).toThrow('UPTIME_KUMA_USERNAME is required');
    expect(() => new ConfigManager()).toThrow('UPTIME_KUMA_PASSWORD is required');
  });
});
