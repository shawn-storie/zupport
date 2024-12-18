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

// Serve common navigation
router.get('/common-nav.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'common-nav.html'));
});

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
  const hostname = os.hostname();
  const env = hostname.startsWith('dv') ? 'Development' :
              hostname.startsWith('sb') ? 'Sandbox' :
              hostname.startsWith('zp') ? 'Production' : 'Other';
  
  if (req.headers['hx-request']) {
    res.send(`
      <div class="version-info">
        <span class="version">v${version}</span>
        <span class="server">${hostname}</span>
        <span class="env-pill ${env.toLowerCase()}">${env}</span>
      </div>
    `);
  } else {
    res.json({ 
      version,
      server: hostname,
      environment: env
    });
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
    const df = execSync('df -h').toString();
    return df.split('\n')
      .slice(1) // Skip header
      .filter(line => line.trim())
      .filter(line => {
        const [filesystem] = line.split(/\s+/);
        return !filesystem.startsWith('tmpfs') && 
               !filesystem.startsWith('devtmpfs') &&
               !filesystem.startsWith('overlay') &&
               !filesystem.includes('loop');
      })
      .map(line => {
        const [filesystem, blocks, used, available, capacity, mountpoint] = line.split(/\s+/);
        const displayName = filesystem.startsWith('127.0.0.1') ? 
          `EFS (${mountpoint})` : 
          filesystem;
        return { 
          filesystem: displayName,
          blocks, 
          used, 
          available, 
          capacity, 
          mountpoint,
          isEFS: filesystem.startsWith('127.0.0.1')
        };
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

function getOSDetails() {
  try {
    // Read OS-release file
    const osRelease = fs.readFileSync('/etc/os-release', 'utf8');
    const name = osRelease.match(/NAME="(.+)"/)?.[1];
    const version = osRelease.match(/VERSION="?([^"\n]+)"?/)?.[1];
    const isAmazonLinux = name?.includes('Amazon Linux');
    
    // Get the latest version from AWS (this is a simplified check)
    const latestVersion = '2023';
    const isLatest = version?.includes(latestVersion);

    return {
      name,
      version,
      isAmazonLinux,
      isLatest,
      status: isAmazonLinux && isLatest ? 'current' : 'outdated'
    };
  } catch (error) {
    return {
      name: 'Unknown',
      version: 'Unknown',
      isAmazonLinux: false,
      isLatest: false,
      status: 'unknown'
    };
  }
}

const queueConfigs = [
  { path: '/zpdata/agents/zippi/outgoing', thresholds: { files: [100, 500, 1000], minutes: [10, 15, 20] } },
  { path: '/zpdata/agents/shipit/outgoing', thresholds: { files: [100, 500, 1000], minutes: [10, 15, 20] } },
  { path: '/zpdata/agents/faxit/outgoing', thresholds: { files: [100, 500, 1000], minutes: [10, 15, 20] } },
  { path: '/zpdata/incoming/outboundMessage', thresholds: { files: [100, 500, 1000], minutes: [3, 6, 10] } },
  { path: '/zpdata/incoming/captured', thresholds: { files: [100, 500, 1000], minutes: [3, 6, 10] } },
  { path: '/zpdata/incoming/outgoing', thresholds: { files: [100, 500, 1000], minutes: [3, 6, 10] } },
  { path: '/zpdata/incoming/routed', thresholds: { files: [100, 500, 1000], minutes: [3, 6, 10] } },
  { path: '/zpdata/incoming/sftp', thresholds: { files: [100, 500, 1000], minutes: [3, 6, 10] } },
  { path: '/zpdata/incoming/smtp', thresholds: { files: [100, 500, 1000], minutes: [3, 6, 10] } },
  { path: '/zpdata/incoming/venali', thresholds: { files: [100, 500, 1000], minutes: [3, 6, 10] } },
  { path: '/zpdata/incoming/zpaper', thresholds: { files: [100, 500, 1000], minutes: [3, 6, 10] } },
  { path: '/zpdata/agents/emailToFaxAgent/errors', thresholds: { files: [2, 5, 10], minutes: [1, 2, 3] } },
  { path: '/zpdata/agents/faxOutAgent/errors', thresholds: { files: [2, 5, 10], minutes: [1, 3, 0] } },
  { path: '/zpdata/agents/outboundMessageAgent/errors', thresholds: { files: [2, 5, 10], minutes: [1, 3, 0] } },
  { path: '/zpdata/agents/routeAgent/errors', thresholds: { files: [2, 5, 10], minutes: [1, 3, 0] } },
  { path: '/zpdata/agents/routeAgentSFTP/errors', thresholds: { files: [2, 5, 10], minutes: [1, 3, 0] } },
  { path: '/zpdata/incoming/sftp/errors', thresholds: { files: [2, 5, 10], minutes: [1, 3, 0] } },
  { path: '/zpdata/logs/errors', thresholds: { files: [2, 5, 10], minutes: [1, 3, 0] } },
  { path: '/zpdata/cache', thresholds: { files: [2, 5, 10], minutes: [60, 0, 0] } },
  { path: '/zpdata/queues/S3/errors', thresholds: { files: [0, 0, 0], minutes: [1, 3, 5] } }
];

async function getQueueStatus() {
  const queues = [];
  let totals = { xml: 0, pdf: 0 };
  
  for (const queue of queueConfigs) {
    try {
      const allFiles = await fsp.readdir(queue.path).catch(() => []);
      const xmlFiles = allFiles.filter(file => file.endsWith('.xml'));
      const pdfFiles = allFiles.filter(file => file.endsWith('.pdf'));
      const files = [...xmlFiles, ...pdfFiles];
      let oldestFile = null;
      let oldestTime = null;
  
      // Check each file's creation time
      if (files.length > 0) {
        for (const file of files) {
          const filePath = path.join(queue.path, file);
          try {
            const stats = await fsp.stat(filePath);
            if (!oldestTime || stats.ctime < oldestTime) {
              oldestTime = stats.ctime;
              oldestFile = {
                name: file,
                created: stats.ctime,
                type: file.endsWith('.xml') ? 'XML' : 'PDF'
              };
            }
          } catch (error) {
            continue;
          }
        }
      }
  
      const counts = {
        xml: xmlFiles.length,
        pdf: pdfFiles.length,
        total: files.length
      };
      totals.xml += counts.xml;
      totals.pdf += counts.pdf;
  
      const status = counts.total === 0 ? 'healthy' : 
                    counts.total >= queue.thresholds.files[2] ? 'dead' :
                    counts.total >= queue.thresholds.files[1] ? 'sick' :
                    counts.total >= queue.thresholds.files[0] ? 'tired' : 'healthy';
  
      queues.push({
        path: queue.path,
        exists: files !== null,
        counts,
        oldestFile,
        thresholds: queue.thresholds,
        status
      });
    } catch (error) {
      queues.push({
        path: queue.path,
        exists: false,
        counts: { xml: 0, pdf: 0, total: 0 },
        thresholds: queue.thresholds,
        status: 'unknown'
      });
    }
  }
  
  return { queues, totals };
}

function getServiceStatus() {
  try {
    const services = [
      { 
        name: 'tomcat9', 
        versionCmd: "java -cp /usr/share/tomcat9/lib/catalina.jar org.apache.catalina.util.ServerInfo | grep 'Server version' | cut -d'/' -f2",
        threadCmd: "ps -L -p $(systemctl show -p MainPID tomcat9 | cut -d= -f2) | wc -l",
        uptimeCmd: "systemctl show -p ActiveEnterTimestamp --value tomcat9 | xargs -I{} date -d {} +%s",
        warFilesCmd: "ls -1 /var/lib/tomcat9/webapps/*.war 2>/dev/null || true"
      },
      { 
        name: 'nodered', 
        versionCmd: "node-red --version 2>/dev/null | grep -o 'v[0-9.]*' || echo unknown",
        threadCmd: "ps -L -p $(systemctl show -p MainPID nodered | cut -d= -f2) | wc -l",
        uptimeCmd: "systemctl show -p ActiveEnterTimestamp --value nodered | xargs -I{} date -d {} +%s"
      },
    ];
    // Get Sprkz status
    let sprkzStatus = null;
    try {
      const sprkzResponse = execSync('curl -s http://localhost:3010/api/v1/endpoint').toString();
      const sprkz = JSON.parse(sprkzResponse);
      if (sprkz.success) {
        sprkzStatus = {
          name: 'Sprkz',
          status: 'active',
          version: sprkz.version
        };
      }
    } catch (error) {
      sprkzStatus = {
        name: 'Sprkz',
        status: 'inactive',
        version: null
      };
    }

    const serviceStatus = services.map(({ name, versionCmd, threadCmd, uptimeCmd, warFilesCmd }) => {
      try {
        const status = execSync(`systemctl is-active ${name}`).toString().trim();
        let memory = 0;
        let cpu = 0;
        let version = execSync(versionCmd).toString().trim();
        let threads = threadCmd ? parseInt(execSync(threadCmd).toString().trim()) : null;
        let uptime = null;
        let warFiles = [];
        
        if (uptimeCmd && status === 'active') {
          const startTime = parseInt(execSync(uptimeCmd).toString().trim());
          const now = Math.floor(Date.now() / 1000);
          uptime = now - startTime;
        }
        
        if (warFilesCmd && status === 'active') {
          warFiles = execSync(warFilesCmd).toString()
            .trim()
            .split('\n')
            .filter(f => f)
            .map(f => path.basename(f));
        }

        if (status === 'active') {
          const pid = execSync(`systemctl show -p MainPID ${name} | cut -d= -f2`).toString().trim();
          const processStats = execSync(`ps -p ${pid} -o %mem,%cpu`).toString().split('\n')[1].trim().split(/\s+/);
          memory = parseFloat(processStats[0]) * totalMemory / 100;
          cpu = parseFloat(processStats[1]);
        }

        return {
          name,
          status,
          memory,
          cpu,
          version,
          threads,
          uptime,
          warFiles
        };
      } catch (error) {
        return { name, status: 'inactive', memory: 0, cpu: 0, version: 'unknown' };
      }
    }).concat([sprkzStatus]);

    // Get top processes by CPU and memory
    const topProcesses = execSync(`ps -eo pid,ppid,%cpu,%mem,comm --sort=-%cpu | head -n 6`).toString()
      .split('\n')
      .slice(1) // Remove header
      .filter(line => line.trim())
      .map(line => {
        const parts = line.trim().split(/\s+/);
        const [pid, ppid, cpu, mem, ...cmdParts] = parts;
        const cmd = cmdParts.join(' ');
        return { 
          pid, 
          ppid, 
          cmd,
          cpu: parseFloat(cpu) || 0,
          mem: parseFloat(mem) || 0
        };
      });

    return { services: serviceStatus, topProcesses };
  } catch (error) {
    return { services: [], topProcesses: [] };
  }
}

// Update the status endpoint
router.get('/status', async (req, res) => {
  try {
    const diskSpace = await checkDiskSpace('/');
    const memDetails = getMemoryDetails();
    const diskDetails = getDiskDetails();
    const queueStatus = await getQueueStatus();
    const osDetails = getOSDetails();
    const serviceStatus = getServiceStatus();
    
    const status = {
      timestamp: new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }),
      system: {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        os: osDetails,
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
      process: {
        pid: process.pid,
        version: process.version,
        uptime: process.uptime(),
      },
      queues: queueStatus.queues,
      totalQueueFiles: queueStatus.totals.total,
      services: serviceStatus.services,
      topProcesses: serviceStatus.topProcesses
    };

    if (req.headers['hx-request']) {
      res.send(`
        <div class="page-header">
          <h1>System Status</h1>
          <h2>${status.system.hostname}</h2>
        </div>
        <div class="status-container">
          
          <div class="status-section">
            <h4>System Information</h4>
            <div class="metric-row">
              <span class="metric-label">Hostname</span>
              <span class="metric-value">${status.system.hostname}</span>
            </div>
            <div class="metric-row ${status.system.os.status !== 'current' ? 'warning-row' : ''}">
              <span class="metric-label">Operating System</span>
              <span class="metric-value">
                ${status.system.os.name} ${status.system.os.version}
                ${status.system.os.status !== 'current' ? 
                  '<span class="warning-badge" title="System not running latest Amazon Linux">⚠️</span>' : 
                  '<span class="success-badge" title="System running latest Amazon Linux">✓</span>'}
              </span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Platform</span>
              <span class="metric-value">${status.system.platform} (${status.system.arch})</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">CPUs</span>
              <span class="metric-value">${status.system.cpus}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Load Average</span>
              <span class="metric-value">${status.system.loadavg.map(load => load.toFixed(2)).join(', ')}</span>
              <div class="progress-wrapper">
                <div class="progress-bar" style="width: ${(status.system.loadavg[0] / status.system.thresholds.load[2]) * 100}%"></div>
              </div>
            </div>
          </div>
          
          <div class="status-section">
            <h4>Memory Usage</h4>
            <div class="metric-row">
              <span class="metric-label">System Memory</span>
              <span class="metric-value">${Math.round((status.memory.used / status.memory.total) * 100)}%</span>
              <div class="progress-wrapper">
                <div class="progress-bar" style="width: ${(status.memory.used / status.memory.total) * 100}%"></div>
              </div>
            </div>
            <div class="metric-row">
              <span class="metric-label">Memory Free</span>
              <span class="metric-value">${status.memory.details.memFree}</span>
            </div>
          </div>
          
          <div class="status-section">
            <h4>Disk Usage</h4>
            <div class="disk-summary">
              <p>Total Free Space: 
                <span class="metric-value">
                  ${status.disk.filesystems
                    .reduce((total, fs) => total + parseFloat(fs.available), 0)
                    .toFixed(1)}G
                </span>
              </p>
            </div>
            ${status.disk.filesystems.map(fs => `
              <div class="metric-row ${fs.isEFS ? 'efs' : ''}">
                <span class="metric-label">${fs.filesystem}</span>
                <span class="metric-value">${fs.capacity}</span>
                <div class="progress-wrapper ${parseInt(fs.capacity) > 90 ? 'critical' : parseInt(fs.capacity) > 70 ? 'warning' : ''}">
                  <div class="progress-bar" style="width: ${fs.capacity}"></div>
                </div>
              </div>
            `).join('')}
          </div>
          
          ${status.tomcat ? `
          <div class="status-section">
            <h4>Tomcat Status</h4>
            <div class="metric-row">
              <span class="metric-label">JVM Memory</span>
              <span class="metric-value">${Math.round(((status.tomcat.jvm.total - status.tomcat.jvm.free) / status.tomcat.jvm.total) * 100)}%</span>
              <div class="progress-wrapper">
                <div class="progress-bar" style="width: ${((status.tomcat.jvm.total - status.tomcat.jvm.free) / status.tomcat.jvm.total) * 100}%"></div>
              </div>
            </div>
            <div class="metric-row">
              <span class="metric-label">Deployed Wars</span>
              <span class="metric-value">
                ${status.tomcat.warFiles.length ? 
                  status.tomcat.warFiles.map(war => `<span class="war-badge">${war}</span>`).join(' ') :
                  'No war files'
                }
              </span>
            </div>
          </div>
          ` : ''}
          
          <div class="status-section">
            <h4>Services</h4>
            ${status.services.map(svc => `
              <div class="metric-row">
                <span class="metric-label">${svc.name}</span>
                <span class="metric-value">
                  ${svc.status === 'active' ? 
                    `<span class="service-status active" title="Service is running">●</span>` : 
                    `<span class="service-status inactive" title="Service is not running">●</span>`}
                  ${svc.status === 'active' ? 
                    `<span class="resource-usage">
                      ${svc.name === 'Sprkz' ? 
                        `v${svc.version}` :
                        `${svc.version || 'unknown'} | CPU: ${svc.cpu.toFixed(1)}% | MEM: ${Math.round(svc.memory / 1024)}MB${
                          svc.threads ? ` | Threads: ${svc.threads}` : ''}${
                          svc.uptime ? ` | Up: ${formatDuration(svc.uptime)}` : ''}`
                      }
                    </span>` : 
                    ''}
                  ${svc.name !== 'Sprkz' ? 
                    `<button class="restart-button" 
                            onclick="restartService('${svc.name}')" 
                            title="Restart ${svc.name}">
                      🔄
                    </button>` :
                    `<button class="restart-button disabled" 
                            title="Restart not available">
                      🔄
                    </button>`
                  }
                </span>
              </div>
            `).join('')}
            
            <h4 class="subsection">Top Processes</h4>
            ${status.topProcesses.map(proc => `
              <div class="metric-row">
                <span class="metric-label" title="${proc.cmd}">${proc.cmd}</span>
                <span class="metric-value">
                  <span class="resource-usage">
                    CPU: ${proc.cpu.toFixed(1)}% | MEM: ${proc.mem > 0 ? proc.mem.toFixed(1) : '0.0'}%
                  </span>
                </span>
              </div>
            `).join('')}
          </div>
          
          <div class="status-section queues">
            <h4>Queue Status</h4>
            <div class="queue-summary">
              <p>
                Total Files: <span class="metric-value">${queueStatus.totals.xml + queueStatus.totals.pdf}</span>
                <span class="file-type-badge xml">XML: ${queueStatus.totals.xml}</span>
                <span class="file-type-badge pdf">PDF: ${queueStatus.totals.pdf}</span>
              </p>
            </div>
            ${status.queues.map(queue => `
              <div class="metric-row ${queue.status !== 'healthy' ? queue.status : ''}">
                <span class="metric-label" title="${queue.path}">
                  ${queue.path.split('/').slice(-2).join('/')}
                </span>
                <span class="metric-value">
                  ${queue.exists ? 
                    `<span class="file-count">
                      ${queue.counts.total}
                      <span class="file-type-badge xml" title="XML Files">XML: ${queue.counts.xml}</span>
                      <span class="file-type-badge pdf" title="PDF Files">PDF: ${queue.counts.pdf}</span>
                    </span>` : 
                    '❌'}
                  ${queue.status !== 'healthy' ? 
                    `<span class="warning-badge" title="${queue.status.toUpperCase()}: ${queue.counts.total} files">⚠️</span>` : 
                    ''}
                  ${queue.oldestFile ? 
                    `<span class="age-badge" title="Oldest ${queue.oldestFile.type}: ${queue.oldestFile.name}">
                      ${formatAge(queue.oldestFile.created)}
                    </span>` : 
                    ''}
                </span>
                <div class="progress-wrapper ${queue.status}">
                  <div class="progress-bar" style="width: ${Math.min(100, (queue.counts.total / queue.thresholds.files[2]) * 100)}%"></div>
                </div>
              </div>
            `).join('')}
          </div>
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

function formatDuration(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatAge(date) {
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
} 

let logGenerator = null;

router.post('/logs/generate', async (req, res) => {
  const { action } = req.body;
  const logFile = path.join(LOG_DIR, 'not-catalina.out');

  if (action === 'start' && !logGenerator) {
    const { generateLogs } = require('./logGenerator');
    const generator = generateLogs();
    
    logGenerator = setInterval(async () => {
      const { value } = await generator.next();
      await fsp.appendFile(logFile, value);
    }, 500);
    
    res.json({ status: 'started' });
  } 
  else if (action === 'stop' && logGenerator) {
    clearInterval(logGenerator);
    logGenerator = null;
    res.json({ status: 'stopped' });
  }
  else {
    res.json({ status: 'no change' });
  }
}); 