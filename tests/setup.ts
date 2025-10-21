// Test setup file
import { config } from '../src/config/config';

// Mock environment variables for testing
process.env.DISCORD_BOT_TOKEN = 'test-token';
process.env.UPTIME_KUMA_URL = 'http://localhost:3001';
process.env.UPTIME_KUMA_USERNAME = 'test-user';
process.env.UPTIME_KUMA_PASSWORD = 'test-password';
process.env.HEALTH_PORT = '3000';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
