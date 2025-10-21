import { ConfigStorage, GuildConfig, MonitorGroup } from '../src/config/storage';
import { existsSync, unlinkSync, mkdirSync, rmdirSync } from 'fs';
import { join } from 'path';

describe('ConfigStorage', () => {
  let storage: ConfigStorage;
  let testDataDir: string;
  let testConfigPath: string;

  beforeEach(() => {
    // Create a temporary test directory
    testDataDir = join(__dirname, 'temp-data');
    testConfigPath = join(testDataDir, 'bot-config.json');
    
    // Set test data directory
    process.env.DATA_DIR = testDataDir;
    
    // Clean up any existing test files
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
    if (existsSync(testDataDir)) {
      rmdirSync(testDataDir);
    }
    
    // Create fresh storage instance
    storage = new ConfigStorage();
  });

  afterEach(() => {
    // Clean up test files
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
    if (existsSync(testDataDir)) {
      rmdirSync(testDataDir);
    }
    
    // Reset environment
    delete process.env.DATA_DIR;
  });

  test('should create default configuration for new guild', () => {
    const guildId = '123456789';
    const config = storage.getConfig(guildId);

    expect(config.channelId).toBeNull();
    expect(config.messageIds).toEqual([]);
    expect(config.monitorIds).toEqual([]);
    expect(config.groups).toEqual([]);
    expect(config.updateInterval).toBe(60000);
    expect(config.embedColor).toBe(5814783);
    expect(config.statusMessage).toBe('Service Status');
  });

  test('should save and load guild configuration', () => {
    const guildId = '123456789';
    
    // Set individual config values
    storage.setChannelId(guildId, '987654321');
    storage.setMessageIds(guildId, ['msg1', 'msg2']);
    storage.setMonitorIds(guildId, [1, 2, 3]);
    storage.setUpdateInterval(guildId, 30000);
    storage.setEmbedColor(guildId, 16711680);
    storage.setStatusMessage(guildId, 'My Custom Status');
    
    const loadedConfig = storage.getConfig(guildId);

    expect(loadedConfig.channelId).toBe('987654321');
    expect(loadedConfig.messageIds).toEqual(['msg1', 'msg2']);
    expect(loadedConfig.monitorIds).toEqual([1, 2, 3]);
    expect(loadedConfig.updateInterval).toBe(30000);
    expect(loadedConfig.embedColor).toBe(16711680);
    expect(loadedConfig.statusMessage).toBe('My Custom Status');
  });

  test('should update specific fields in guild configuration', () => {
    const guildId = '123456789';
    
    // Set initial config
    storage.setChannelId(guildId, 'channel123');
    storage.setMessageIds(guildId, ['msg1', 'msg2']);
    storage.setMonitorIds(guildId, [1, 2, 3]);
    
    const config = storage.getConfig(guildId);
    expect(config.channelId).toBe('channel123');
    expect(config.messageIds).toEqual(['msg1', 'msg2']);
    expect(config.monitorIds).toEqual([1, 2, 3]);
  });

  test('should manage monitor groups', () => {
    const guildId = '123456789';
    
    // Create groups
    storage.addGroup(guildId, 'Media Servers');
    storage.addGroup(guildId, 'Gaming');
    
    const groups = storage.getGroups(guildId);
    expect(groups).toHaveLength(2);
    expect(groups[0].name).toBe('Media Servers');
    expect(groups[1].name).toBe('Gaming');
    
    // Add monitors to group
    storage.addMonitorToGroup(guildId, 'Media Servers', 1);
    storage.addMonitorToGroup(guildId, 'Media Servers', 2);
    storage.addMonitorToGroup(guildId, 'Gaming', 3);
    
    const updatedGroups = storage.getGroups(guildId);
    expect(updatedGroups[0].monitorIds).toEqual([1, 2]);
    expect(updatedGroups[1].monitorIds).toEqual([3]);
  });

  test('should remove monitors from groups', () => {
    const guildId = '123456789';
    
    storage.addGroup(guildId, 'Media Servers');
    storage.addMonitorToGroup(guildId, 'Media Servers', 1);
    storage.addMonitorToGroup(guildId, 'Media Servers', 2);
    
    storage.removeMonitorFromGroup(guildId, 1);
    
    const groups = storage.getGroups(guildId);
    expect(groups[0].monitorIds).toEqual([2]);
  });

  test('should delete groups', () => {
    const guildId = '123456789';
    
    storage.addGroup(guildId, 'Media Servers');
    storage.addGroup(guildId, 'Gaming');
    
    expect(storage.getGroups(guildId)).toHaveLength(2);
    
    storage.removeGroup(guildId, 'Media Servers');
    
    const groups = storage.getGroups(guildId);
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('Gaming');
  });

  test('should get all guild IDs', () => {
    storage.setChannelId('guild1', 'channel1');
    storage.setChannelId('guild2', 'channel2');
    storage.setChannelId('guild3', 'channel3');
    
    const guildIds = storage.getAllGuildIds();
    expect(guildIds).toHaveLength(3);
    expect(guildIds).toContain('guild1');
    expect(guildIds).toContain('guild2');
    expect(guildIds).toContain('guild3');
  });

  test('should handle non-existent groups gracefully', () => {
    const guildId = '123456789';
    
    // Try to add monitor to non-existent group
    expect(() => storage.addMonitorToGroup(guildId, 'Non-existent', 1)).not.toThrow();
    
    // Try to remove monitor from non-existent group
    expect(() => storage.removeMonitorFromGroup(guildId, 1)).not.toThrow();
    
    // Try to delete non-existent group
    expect(() => storage.removeGroup(guildId, 'Non-existent')).not.toThrow();
  });

  test('should persist configuration to file', () => {
    const guildId = '123456789';
    storage.setChannelId(guildId, 'channel123');
    storage.setMonitorIds(guildId, [1, 2, 3]);
    
    // Create new storage instance to test persistence
    const newStorage = new ConfigStorage();
    const config = newStorage.getConfig(guildId);
    
    expect(config.channelId).toBe('channel123');
    expect(config.monitorIds).toEqual([1, 2, 3]);
  });

  test('should handle file read errors gracefully', () => {
    // Create invalid JSON file
    const fs = require('fs');
    fs.writeFileSync(testConfigPath, 'invalid json');
    
    // Should not throw error, should create default config
    expect(() => new ConfigStorage()).not.toThrow();
    
    const storage = new ConfigStorage();
    const config = storage.getConfig('test-guild');
    expect(config.channelId).toBeNull();
  });
});
