// Import required dependencies
const express = require('express');
const WebSocket = require('ws');
const winston = require('winston');
const http = require('http');
const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const checkDiskSpace = require('check-disk-space').default;
const { exec } = require('child_process');
const { version } = require('./version');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yaml');

// Environment variables configuration with default values
const PORT = process.env.PORT || 4111;
const LOG_DIR = process.env.ZUPPORT_LOG_DIR || path.join(__dirname, 'logs');
const EDITABLE_DIR = process.env.ZUPPORT_EDITABLE_DIR || process.cwd();
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
// Enable console logging in non-production environments by default
const CONSOLE_LOGGING = process.env.CONSOLE_LOGGING === 'true' || process.env.NODE_ENV !== 'production';

// Configure Winston logger with file transports
const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    // Separate transport for error logs
    new winston.transports.File({ filename: path.join(LOG_DIR, 'error.log'), level: 'error' }),
    // Combined logs for all levels
    new winston.transports.File({ filename: path.join(LOG_DIR, 'combined.log') })
  ]
});

// Add console transport if enabled
if (CONSOLE_LOGGING) {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Initialize Express app and create HTTP server
const app = express();
const server = http.createServer(app);
// Initialize WebSocket server
const wss = new WebSocket.Server({ server });

// Add after app initialization
const BASE_PATH = process.env.BASE_PATH || '/zupport';
const router = express.Router();

// Move all routes to router
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

router.get('/logs', async (req, res) => {
  try {
    const files = await fsp.readdir(LOG_DIR);
    res.json({ logs: files });
  } catch (error) {
    logger.error('Error reading logs directory:', error);
    res.status(500).json({ error: 'Failed to read logs directory' });
  }
});

router.get('/editable-files', async (req, res) => {
  try {
    const files = await fsp.readdir(EDITABLE_DIR);
    res.json({ files });
  } catch (error) {
    logger.error('Error reading editable directory:', error);
    res.status(500).json({ error: 'Failed to read editable directory' });
  }
});

router.get('/file-content', async (req, res) => {
  const { file } = req.query;
  if (!file) {
    return res.status(400).json({ error: 'File parameter is required' });
  }

  try {
    const filePath = path.join(EDITABLE_DIR, file);
    const content = await fsp.readFile(filePath, 'utf8');
    res.json({ content });
  } catch (error) {
    logger.error(`Error reading file ${file}:`, error);
    res.status(500).json({ error: 'Failed to read file' });
  }
});

router.post('/edit-file', async (req, res) => {
  const { filePath, content } = req.body;
  if (!filePath || content === undefined) {
    return res.status(400).json({ error: 'File path and content are required' });
  }

  try {
    const fullPath = path.join(EDITABLE_DIR, filePath);
    await fsp.writeFile(fullPath, content);
    res.json({ message: 'File updated successfully' });
  } catch (error) {
    logger.error(`Error writing to file ${filePath}:`, error);
    res.status(500).json({ error: 'Failed to write file' });
  }
});

router.post('/execute', async (req, res) => {
  const { command } = req.body;
  if (!command) {
    return res.status(400).json({ error: 'Command is required' });
  }

  exec(command, (error, stdout, stderr) => {
    if (error) {
      logger.error(`Error executing command ${command}:`, error);
      return res.status(500).json({ error: error.message });
    }
    res.json({ stdout, stderr });
  });
});

router.get('/server-stats', async (req, res) => {
  try {
    const diskSpace = await checkDiskSpace('/');
    const stats = {
      memory: {
        total: process.memoryUsage().heapTotal,
        used: process.memoryUsage().heapUsed
      },
      uptime: process.uptime(),
      disk: {
        total: diskSpace.size,
        free: diskSpace.free,
        used: diskSpace.size - diskSpace.free
      }
    };

    if (req.headers['hx-request']) {
      res.send(`
        <div>
          <h3>Server Stats</h3>
          <p>Memory Used: ${Math.round(stats.memory.used / 1024 / 1024)}MB</p>
          <p>Uptime: ${Math.round(stats.uptime / 60)} minutes</p>
          <p>Disk Free: ${Math.round(stats.disk.free / 1024 / 1024)}MB</p>
        </div>
      `);
    } else {
      res.json(stats);
    }
  } catch (error) {
    logger.error('Error getting server stats:', error);
    res.status(500).json({ error: 'Failed to get server stats' });
  }
});

router.get('/version', async (req, res) => {
  // Return HTML for HTMX requests
  if (req.headers['hx-request']) {
    res.send(`<div>API Version: ${version}</div>`);
  } else {
    // Return JSON for API requests
    res.json({ version });
  }
});

// WebSocket handler for real-time log streaming
wss.on('connection', (ws, req) => {
  // Extract log file name from query parameters
  const logFile = new URL(req.url, 'http://localhost').searchParams.get('log');
  if (!logFile) {
    ws.close();
    return;
  }

  const logPath = path.join(LOG_DIR, logFile);
  const tail = require('tail').Tail;
  
  try {
    // Create tail process to watch log file
    const tailProcess = new tail(logPath);
    // Send new log lines to connected client
    tailProcess.on('line', (data) => {
      ws.send(JSON.stringify({ timestamp: new Date(), message: data }));
    });

    // Clean up tail process when connection closes
    ws.on('close', () => {
      tailProcess.unwatch();
    });
  } catch (error) {
    logger.error(`Error setting up log streaming for ${logFile}:`, error);
    ws.close();
  }
});

// Use router with base path
app.use(BASE_PATH, express.json());
app.use(`${BASE_PATH}/api-docs`, swaggerUi.serve, swaggerUi.setup(openApiSpec));
app.use(BASE_PATH, router);

// Load OpenAPI spec
const openApiSpec = YAML.parse(fs.readFileSync('./openapi.yaml', 'utf8'));

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server running on 0.0.0.0:${PORT}`);
}); 