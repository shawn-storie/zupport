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

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, 'public')));

  // Serve OpenAPI documentation
  const swaggerDocument = YAML.load(path.join(__dirname, 'openapi.yaml'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

  // WebSocket server for log streaming
  const wss = new WebSocket.Server({ noServer: true });

  wss.on('connection', (ws, req) => {
    console.log('WebSocket client connected');
    
    const logFile = new URL(req.url, 'http://localhost').searchParams.get('log');
    const logStream = streamLogsFromDirectory(logDir, ws, logFile);

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      clearInterval(logStream);
    });
  });

  /**
   * Streams logs from the specified directory
   * @param {string} directory - The directory containing log files
   * @param {WebSocket} ws - The WebSocket connection to stream logs to
   * @param {string|null} specificLog - The specific log file to stream, or null to stream all logs
   * @returns {NodeJS.Timeout} The interval ID for the streaming process
   */
  function streamLogsFromDirectory(directory, ws, specificLog = null) {
    return setInterval(async () => {
      try {
        const files = await fs.readdir(directory);
        for (const file of files) {
          if (path.extname(file) === '.log' && (!specificLog || file === specificLog)) {
            const content = await fs.readFile(path.join(directory, file), 'utf-8');
            const lines = content.split('\n').filter(Boolean);
            const lastLine = lines[lines.length - 1];
            ws.send(JSON.stringify({ timestamp: new Date(), file, message: lastLine }));
          }
        }
      } catch (error) {
        console.error('Error reading log directory:', error);
        ws.send(JSON.stringify({ error: 'Error reading logs', details: error.message }));
      }
    }, 1000);
  }

  /**
   * Determines if the response should be in HTML format
   * @param {express.Request} req - The Express request object
   * @returns {boolean} True if the response should be HTML, false otherwise
   */
  function shouldRespondWithHtml(req) {
    return !req.get('Accept') || req.get('Accept').includes('text/html');
  }

  // Route for the main page
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  // Route for the log viewer
  app.get('/log-viewer', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'log-viewer.html'));
  });

  // Route for the file editor
  app.get('/file-editor', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'file-editor.html'));
  });

  /**
   * Route to get list of available logs
   * @route GET /logs
   * @returns {Object} JSON object containing list of log files or HTML content
   */
  app.get('/logs', async (req, res) => {
    try {
      const files = await fs.readdir(logDir);
      const logFiles = files.filter(file => path.extname(file) === '.log');
      
      if (shouldRespondWithHtml(req)) {
        const logList = logFiles.map(file => `
          <div class="log-entry" hx-get="/log-stream?log=${file}" hx-target="#log-content" hx-swap="innerHTML">
            ${file}
          </div>
        `).join('');
        res.send(`
          <div id="log-list">
            <h2>Available Logs</h2>
            ${logList}
          </div>
        `);
      } else {
        res.json({ logs: logFiles });
      }
    } catch (error) {
      console.error('Error retrieving logs:', error);
      if (shouldRespondWithHtml(req)) {
        res.status(500).send(`<div id="error">Error retrieving logs: ${error.message}</div>`);
      } else {
        res.status(500).json({ error: 'Error retrieving logs', details: error.message });
      }
    }
  });

  /**
   * Route to stream a specific log
   * @route GET /log-stream
   * @param {string} log - The name of the log file to stream
   * @returns {string} HTML content for log streaming
   */
  app.get('/log-stream', (req, res) => {
    const logFile = req.query.log;
    if (!logFile) {
      return res.status(400).send('Log file not specified');
    }
    res.send(`
      <div id="log-content" hx-ext="ws" ws-connect="/ws?log=${logFile}">
        Connecting...
      </div>
    `);
  });

  /**
   * Route to get list of editable files
   * @route GET /editable-files
   * @returns {Object} JSON object containing list of editable files or HTML content
   */
  app.get('/editable-files', async (req, res) => {
    try {
      const files = await fs.readdir(editableDir);
      
      if (shouldRespondWithHtml(req)) {
        const fileList = files.map(file => `
          <div class="file-entry" hx-get="/file-content?file=${file}" hx-target="#file-content">
            ${file}
          </div>
        `).join('');
        res.send(`
          <div id="file-list">
            <h2>Editable Files</h2>
            ${fileList}
          </div>
        `);
      } else {
        res.json({ files });
      }
    } catch (error) {
      console.error('Error retrieving editable files:', error);
      if (shouldRespondWithHtml(req)) {
        res.status(500).send(`<div id="error">Error retrieving editable files: ${error.message}</div>`);
      } else {
        res.status(500).json({ error: 'Error retrieving editable files', details: error.message });
      }
    }
  });

  /**
   * Route to get file content
   * @route GET /file-content
   * @param {string} file - The name of the file to retrieve content from
   * @returns {Object} JSON object containing the file content
   */
  app.get('/file-content', async (req, res) => {
    const file = req.query.file;
    if (!file) {
      return res.status(400).send('File not specified');
    }
    try {
      const content = await fs.readFile(path.join(editableDir, file), 'utf-8');
      res.json({ content });
    } catch (error) {
      console.error('Error reading file:', error);
      res.status(500).json({ error: 'Error reading file', details: error.message });
    }
  });

  /**
   * Route to edit file
   * @route POST /edit-file
   * @param {Object} req.body - The request body
   * @param {string} req.body.filePath - The path of the file to edit
   * @param {string} req.body.content - The new content of the file
   * @returns {Object} JSON object with a success message or error details
   */
  app.post('/edit-file', async (req, res) => {
    const { filePath, content } = req.body;
    
    if (!filePath || content === undefined) {
      return res.status(400).json({ error: 'Missing filePath or content in request body' });
    }

    const fullPath = path.join(editableDir, filePath);

    if (!fullPath.startsWith(editableDir)) {
      return res.status(403).json({ error: 'Access denied: Cannot edit files outside the specified directory.' });
    }
    
    try {
      await fs.writeFile(fullPath, content);
      res.json({ message: 'File edited successfully' });
    } catch (error) {
      console.error('Error editing file:', error);
      res.status(500).json({ error: 'Error editing file', details: error.message });
    }
  });

  /**
   * Route to get server health
   * @route GET /health
   * @returns {Object} JSON object containing server health information or HTML content
   */
  app.get('/health', (req, res) => {
    const health = {
      uptime: process.uptime(),
      message: 'OK',
      timestamp: Date.now(),
      cpuUsage: process.cpuUsage(),
      memoryUsage: process.memoryUsage(),
      osInfo: {
        platform: os.platform(),
        version: os.version(),
        totalMem: os.totalmem(),
        freeMem: os.freemem(),
      }
    };
    
    if (shouldRespondWithHtml(req)) {
      res.send(`
        <div hx-swap-oob="true" id="health">
          <h2>Server Health</h2>
          <pre>${JSON.stringify(health, null, 2)}</pre>
        </div>
      `);
    } else {
      res.json(health);
    }
  });

  /**
   * Route to execute commands
   * @route POST /execute
   * @param {Object} req.body - The request body
   * @param {string} req.body.command - The command to execute
   * @returns {Object} JSON object containing command output or HTML content
   */
  app.post('/execute', (req, res) => {
    const { command } = req.body;

    if (!command) {
      return res.status(400).json({ error: 'Missing command in request body' });
    }
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Error executing command:', error);
        if (shouldRespondWithHtml(req)) {
          res.status(500).send('<div hx-swap-oob="true" id="result">Error: ' + error.message + '</div>');
        } else {
          res.status(500).json({ error: error.message });
        }
        return;
      }
      
      if (shouldRespondWithHtml(req)) {
        res.send(`
          <div hx-swap-oob="true" id="result">
            <h3>Command Output:</h3>
            <pre>${stdout}</pre>
            ${stderr ? `<h3>Error Output:</h3><pre>${stderr}</pre>` : ''}
          </div>
        `);
      } else {
        res.json({ stdout, stderr });
      }
    });
  });

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

module.exports = createZupportApi;
