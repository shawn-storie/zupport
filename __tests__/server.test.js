const request = require('supertest');
const express = require('express');
const app = require('../server');

describe('API Endpoints', () => {
  test('GET /health returns healthy status', async () => {
    const response = await request(app).get('/health');
    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('healthy');
  });

  test('GET /version returns version', async () => {
    const response = await request(app).get('/version');
    expect(response.statusCode).toBe(200);
    expect(response.body.version).toBeDefined();
  });

  // Add more tests as needed
}); 