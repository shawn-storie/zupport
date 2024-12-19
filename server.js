// Import required dependencies
require('dotenv').config();
const express = require('express');
const WebSocket = require('ws');
const winston = require('winston');
const http = require('http');
const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const checkDiskSpace = require('check-disk-space').default;
const { exec, execSync } = require('child_process');
const { version } = require('./version');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yaml');
const os = require('os');

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

// Load OpenAPI spec
const openApiSpec = YAML.parse(fs.readFileSync('./openapi.yaml', 'utf8'));

// Use router with base path
app.use(BASE_PATH, express.json());
app.use(`${BASE_PATH}/api-docs`, swaggerUi.serve, swaggerUi.setup(openApiSpec));
app.use(BASE_PATH, router);

// Add after other middleware
app.use(BASE_PATH, express.static('public'));

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

// Add these helper functions at the top
function getMemoryDetails() {
  try {
    const meminfo = execSync('cat /proc/meminfo').toString();
    const memFree = meminfo.match(/MemFree:\s+(\d+)/)?.[1] || 0;
    const swapFree = meminfo.match(/SwapFree:\s+(\d+)/)?.[1] || 0;
    return { memFree, swapFree };
  } catch (error) {
    return { memFree: 0, swapFree: 0 };
  }
}

function getDiskDetails() {
  try {
    const df = execSync('df -k').toString();
    return df.split('\n')
      .slice(1) // Skip header
      .filter(line => line.trim())
      .map(line => {
        const [filesystem, blocks, used, available, capacity, mountpoint] = line.split(/\s+/);
        return { filesystem, blocks, used, available, capacity, mountpoint };
      });
  } catch (error) {
    return [];
  }
}

function getTomcatStatus() {
  try {
    // Assuming Tomcat manager is accessible
    const response = execSync('curl -s http://localhost:8080/manager/status?XML=true').toString();
    // Parse XML response - you might want to use an XML parser here
    const jvmFree = response.match(/free="(\d+)"/)?.[1] || 0;
    const jvmTotal = response.match(/total="(\d+)"/)?.[1] || 0;
    const jvmMax = response.match(/max="(\d+)"/)?.[1] || 0;
    const currentThreads = response.match(/currentThreadCount="(\d+)"/)?.[1] || 0;
    const maxTime = response.match(/maxTime="(\d+)"/)?.[1] || 0;
    
    return {
      jvm: { free: jvmFree, total: jvmTotal, max: jvmMax },
      connector: { currentThreads, maxTime }
    };
  } catch (error) {
    return null;
  }
}

// Update the status endpoint
router.get('/status', async (req, res) => {
  try {
    const diskSpace = await checkDiskSpace('/');
    const memDetails = getMemoryDetails();
    const diskDetails = getDiskDetails();
    const tomcatStatus = getTomcatStatus();
    
    const status = {
      timestamp: new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }),
      system: {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        uptime: os.uptime(),
        loadavg: os.loadavg(),
        thresholds: {
          load: [2.8, 5.0, 8.0],
          threads: [30, 120, 300]
        }
      },
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
        process: process.memoryUsage(),
        details: {
          memFree: `${memDetails.memFree} kB`,
          swapFree: `${memDetails.swapFree} kB`
        }
      },
      disk: {
        total: diskSpace.size,
        free: diskSpace.free,
        used: diskSpace.size - diskSpace.free,
        filesystems: diskDetails
      },
      tomcat: tomcatStatus,
      process: {
        pid: process.pid,
        version: process.version,
        uptime: process.uptime(),
      }
    };

    if (req.headers['hx-request']) {
      // Update the HTMX response to include new sections
      res.send(`
        <div class="status-container">
          <h3>System Status for ${status.system.hostname}</h3>
          
          <div class="status-section">
            <h4>System Information</h4>
            <p>Hostname: <span class="metric-value">${status.system.hostname}</span></p>
            <p>Platform: <span class="metric-value">${status.system.platform} (${status.system.arch})</span></p>
            <p>CPUs: <span class="metric-value">${status.system.cpus}</span></p>
            <p>Load Average: <span class="metric-value">${status.system.loadavg.map(load => load.toFixed(2)).join(', ')}</span></p>
            <p>Load Thresholds: <span class="metric-value">${status.system.thresholds.load.join(', ')}</span></p>
          </div>
          
          <div class="status-section">
            <h4>Memory Usage</h4>
            <p>System Memory
              <span class="progress-text">${Math.round((status.memory.used / status.memory.total) * 100)}%</span>
              <span data-progress="${(status.memory.used / status.memory.total) * 100}"></span>
            </p>
            <p>MemFree: <span class="metric-value">${status.memory.details.memFree}</span></p>
            <p>SwapFree: <span class="metric-value">${status.memory.details.swapFree}</span></p>
          </div>
          
          <div class="status-section">
            <h4>Disk Usage</h4>
            ${status.disk.filesystems.map(fs => `
              <p>${fs.filesystem} (${fs.mountpoint})
                <span class="progress-text">${fs.capacity}</span>
                <span data-progress="${parseInt(fs.capacity)}"></span>
              </p>
            `).join('')}
          </div>
          
          ${status.tomcat ? `
          <div class="status-section">
            <h4>Tomcat Status</h4>
            <p>JVM Memory
              <span class="progress-text">${Math.round(((status.tomcat.jvm.total - status.tomcat.jvm.free) / status.tomcat.jvm.total) * 100)}%</span>
              <span data-progress="${((status.tomcat.jvm.total - status.tomcat.jvm.free) / status.tomcat.jvm.total) * 100}"></span>
            </p>
            <p>Current Threads: <span class="metric-value">${status.tomcat.connector.currentThreads}</span></p>
            <p>Max Response Time: <span class="metric-value">${status.tomcat.connector.maxTime}ms</span></p>
          </div>
          ` : ''}
        </div>
      `);
    } else {
      res.json(status);
    }
  } catch (error) {
    logger.error('Error getting system status:', error);
    res.status(500).json({ error: 'Failed to get system status' });
  }
});

// WebSocket handler for real-time log streaming
wss.on('connection', (ws, req) => {
  const params = new URL(req.url, 'http://localhost').searchParams;
  const logFile = params.get('log');
  const logLevel = params.get('level')?.toUpperCase(); // Get optional level parameter

  if (!logFile) {
    ws.close();
    return;
  }

  const logPath = path.join(LOG_DIR, logFile);
  const tail = require('tail').Tail;
  
  try {
    const tailProcess = new tail(logPath);
    tailProcess.on('line', (data) => {
      // Only send if no level specified or line contains the specified level
      if (!logLevel || data.includes(logLevel)) {
        ws.send(JSON.stringify({ 
          timestamp: new Date(), 
          message: data,
          level: logLevel || 'ALL'
        }));
      }
    });

    ws.on('close', () => {
      tailProcess.unwatch();
    });
  } catch (error) {
    logger.error(`Error setting up log streaming for ${logFile}:`, error);
    ws.close();
  }
});

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server running on 0.0.0.0:${PORT}`);
}); 