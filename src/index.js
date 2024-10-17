// File: src/index.js
const express = require('express');
const WebSocket = require('ws');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const os = require('os');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

/**
 * Creates and configures the Zupport API server
 * @param {Object} options - Configuration options
 * @param {number} [options.port] - The port number for the server to listen on
 * @returns {Object} An object containing the Express app and a start function
 */
function createZupportApi(options = {}) {
  const app = express();
  const port = options.port || process.env.PORT || 3000;
  const logDir = process.env.ZUPPORT_LOG_DIR || path.join(__dirname, '..', 'logs');
  const editableDir = process.env.ZUPPORT_EDITABLE_DIR || process.cwd();

  // ... (rest of the code remains the same)

  /**
   * Starts the server
   * @returns {http.Server} The HTTP server instance
   */
  function start() {
    const server = app.listen(port, () => {
      console.log(`Zupport API listening at http://localhost:${port}`);
      console.log(`Log directory: ${logDir}`);
      console.log(`Editable directory: ${editableDir}`);
    });

    // Integrate WebSocket server with HTTP server
    server.on('upgrade', (request, socket, head) => {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    });

    return server;
  }

  return {
    app,
    start
  };
}

// If this file is run directly, start the server
if (require.main === module) {
  const { start } = createZupportApi();
  start();
}

module.exports = createZupportApi;
