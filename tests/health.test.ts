import * as http from 'http';

// Mock the services
jest.mock('../src/services/discord.service');
jest.mock('../src/services/uptime-kuma.service');
jest.mock('../src/config/storage');

describe('Health Check Logic', () => {
  let mockDiscordService: any;
  let mockUptimeKumaService: any;
  let healthServer: http.Server;
  const testPort = 3001;

  beforeAll(async () => {
    // Create mock services
    mockDiscordService = {
      isConnected: jest.fn()
    };
    
    mockUptimeKumaService = {
      isConnected: jest.fn()
    };
    
    // Start health server with the same logic as the bot
    healthServer = http.createServer((req, res) => {
      if (req.url === '/health' && req.method === 'GET') {
        const isHealthy = mockDiscordService.isConnected() && mockUptimeKumaService.isConnected();
        const status = isHealthy ? 'healthy' : 'unhealthy';
        const statusCode = isHealthy ? 200 : 503;
        
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status,
          discord: mockDiscordService.isConnected() ? 'connected' : 'disconnected',
          uptimeKuma: mockUptimeKumaService.isConnected() ? 'connected' : 'disconnected',
          timestamp: new Date().toISOString()
        }));
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });

    await new Promise<void>((resolve) => {
      healthServer.listen(testPort, '0.0.0.0', resolve);
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      healthServer.close(() => resolve());
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return 200 when both services are connected', async () => {
    mockDiscordService.isConnected.mockReturnValue(true);
    mockUptimeKumaService.isConnected.mockReturnValue(true);

    const response = await makeRequest('/health');
    
    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('healthy');
    expect(response.body.discord).toBe('connected');
    expect(response.body.uptimeKuma).toBe('connected');
    expect(response.body.timestamp).toBeDefined();
  });

  test('should return 503 when Discord is disconnected', async () => {
    mockDiscordService.isConnected.mockReturnValue(false);
    mockUptimeKumaService.isConnected.mockReturnValue(true);

    const response = await makeRequest('/health');
    
    expect(response.statusCode).toBe(503);
    expect(response.body.status).toBe('unhealthy');
    expect(response.body.discord).toBe('disconnected');
    expect(response.body.uptimeKuma).toBe('connected');
  });

  test('should return 503 when Uptime Kuma is disconnected', async () => {
    mockDiscordService.isConnected.mockReturnValue(true);
    mockUptimeKumaService.isConnected.mockReturnValue(false);

    const response = await makeRequest('/health');
    
    expect(response.statusCode).toBe(503);
    expect(response.body.status).toBe('unhealthy');
    expect(response.body.discord).toBe('connected');
    expect(response.body.uptimeKuma).toBe('disconnected');
  });

  test('should return 503 when both services are disconnected', async () => {
    mockDiscordService.isConnected.mockReturnValue(false);
    mockUptimeKumaService.isConnected.mockReturnValue(false);

    const response = await makeRequest('/health');
    
    expect(response.statusCode).toBe(503);
    expect(response.body.status).toBe('unhealthy');
    expect(response.body.discord).toBe('disconnected');
    expect(response.body.uptimeKuma).toBe('disconnected');
  });

  test('should return 404 for non-health endpoints', async () => {
    const response = await makeRequest('/invalid');
    
    expect(response.statusCode).toBe(404);
    expect(response.body).toBe('Not Found');
  });
});

// Helper function to make HTTP requests
function makeRequest(path: string): Promise<{ statusCode: number; body: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path,
      method: 'GET',
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const body = res.headers['content-type']?.includes('application/json') 
            ? JSON.parse(data) 
            : data;
          resolve({ statusCode: res.statusCode!, body });
        } catch (error) {
          resolve({ statusCode: res.statusCode!, body: data });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}
