// __tests__/api.test.js
const request = require('supertest');
const createZupportApi = require('../src/index');
const fs = require('fs').promises;
const path = require('path');

let app;
let server;

beforeAll(async () => {
  const { app: expressApp, start } = createZupportApi();
  app = expressApp;
  server = start();

  // Create a test log file
  const logDir = process.env.ZUPPORT_LOG_DIR || path.join(__dirname, '..', 'logs');
  await fs.writeFile(path.join(logDir, 'test.log'), 'Test log entry');
});

afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
});

describe('API Endpoints', () => {
  test('GET /logs should return list of log files', async () => {
    const response = await request(app).get('/logs');
    expect(response.status).toBe(200);
    expect(response.body.logs).toContain('test.log');
  });

  test('GET /health should return server health information', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('uptime');
    expect(response.body).toHaveProperty('cpuUsage');
  });

  test('POST /execute should execute a command', async () => {
    const response = await request(app)
      .post('/execute')
      .send({ command: 'echo "Hello, World!"' });
    expect(response.status).toBe(200);
    expect(response.body.stdout).toBe('Hello, World!\n');
  });

  // Add more tests for other endpoints...
});

describe('File Operations', () => {
  test('GET /editable-files should return list of editable files', async () => {
    const response = await request(app).get('/editable-files');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('files');
  });

  // Add more tests for file operations...
});

// Add more test suites for WebSocket functionality, logging, etc.
