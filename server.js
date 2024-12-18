const express = require('express');
const WebSocket = require('ws');
const winston = require('winston');
const http = require('http');
const path = require('path');
const fs = require('fs').promises;
const diskusage = require('disk-usage');
const { exec } = require('child_process');
const { version } = require('./version');

// Environment variables with defaults
const PORT = process.env.PORT || 3000;
const LOG_DIR = process.env.ZUPPORT_LOG_DIR || path.join(__dirname, 'logs');
const EDITABLE_DIR = process.env.ZUPPORT_EDITABLE_DIR || process.cwd();
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const CONSOLE_LOGGING = process.env.CONSOLE_LOGGING === 'true' || process.env.NODE_ENV !== 'production';

// Configure Winston logger
const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: path.join(LOG_DIR, 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(LOG_DIR, 'combined.log') })
  ]
});

if (CONSOLE_LOGGING) {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  const logFile = new URL(req.url, 'http://localhost').searchParams.get('log');
  if (!logFile) {
    ws.close();
    return;
  }

  const logPath = path.join(LOG_DIR, logFile);
  const tail = require('tail').Tail;
  
  try {
    const tailProcess = new tail(logPath);
    tailProcess.on('line', (data) => {
      ws.send(JSON.stringify({ timestamp: new Date(), message: data }));
    });

    ws.on('close', () => {
      tailProcess.unwatch();
    });
  } catch (error) {
    logger.error(`Error setting up log streaming for ${logFile}:`, error);
    ws.close();
  }
});

// API Routes
app.get('/logs', async (req, res) => {
  try {
    const files = await fs.readdir(LOG_DIR);
    res.json({ logs: files });
  } catch (error) {
    logger.error('Error reading logs directory:', error);
    res.status(500).json({ error: 'Failed to read logs directory' });
  }
});

app.get('/editable-files', async (req, res) => {
  try {
    const files = await fs.readdir(EDITABLE_DIR);
    res.json({ files });
  } catch (error) {
    logger.error('Error reading editable directory:', error);
    res.status(500).json({ error: 'Failed to read editable directory' });
  }
});

app.get('/file-content', async (req, res) => {
  const { file } = req.query;
  if (!file) {
    return res.status(400).json({ error: 'File parameter is required' });
  }

  try {
    const filePath = path.join(EDITABLE_DIR, file);
    const content = await fs.readFile(filePath, 'utf8');
    res.json({ content });
  } catch (error) {
    logger.error(`Error reading file ${file}:`, error);
    res.status(500).json({ error: 'Failed to read file' });
  }
});

app.post('/edit-file', async (req, res) => {
  const { filePath, content } = req.body;
  if (!filePath || content === undefined) {
    return res.status(400).json({ error: 'File path and content are required' });
  }

  try {
    const fullPath = path.join(EDITABLE_DIR, filePath);
    await fs.writeFile(fullPath, content);
    res.json({ message: 'File updated successfully' });
  } catch (error) {
    logger.error(`Error writing to file ${filePath}:`, error);
    res.status(500).json({ error: 'Failed to write file' });
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.post('/execute', (req, res) => {
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

app.get('/server-stats', (req, res) => {
  try {
    const stats = {
      memory: {
        total: process.memoryUsage().heapTotal,
        used: process.memoryUsage().heapUsed
      },
      uptime: process.uptime(),
      disk: diskusage.checkSync('/')
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

app.get('/version', (req, res) => {
  if (req.headers['hx-request']) {
    res.send(`<div>API Version: ${version}</div>`);
  } else {
    res.json({ version });
  }
});

// Start server
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
}); 