# Zupport API

Zupport API is a comprehensive Node.js-based solution for log streaming, file editing, server health monitoring, and command execution. It provides both a RESTful API and a web interface for easy interaction.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Web Interface](#web-interface)
- [Configuration](#configuration)
- [Initializing Sample Logs](#initializing-sample-logs)
- [Examples](#examples)
- [Contributing](#contributing)
- [License](#license)

## Features

- Real-time log streaming via WebSockets
- File editing with Monaco Editor integration
- Server health monitoring
- Command execution
- Web interface for easy interaction
- RESTful API for programmatic access
- OpenAPI documentation

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/shawn-storie/zupport.git
   cd zupport-api
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables (optional):
   ```bash
   export ZUPPORT_LOG_DIR=/path/to/logs
   export ZUPPORT_EDITABLE_DIR=/path/to/editable/files
   export PORT=3000
   ```

4. Initialize sample logs (optional, see [Initializing Sample Logs](#initializing-sample-logs) section)

5. Start the server:
   ```bash
   npm start
   ```

## Usage

After starting the server, you can access the web interface at `http://localhost:3000` (or the port you specified).

For programmatic access, you can use the API endpoints directly. Refer to the [API Endpoints](#api-endpoints) section for details.

## API Endpoints

- `GET /logs`: Retrieve a list of available log files
- `GET /log-stream`: Stream a specific log file in real-time (WebSocket)
- `GET /editable-files`: Get a list of editable files
- `GET /file-content`: Retrieve the content of a specific file
- `POST /edit-file`: Edit a file
- `GET /health`: Get server health information
- `POST /execute`: Execute a command on the server

For detailed API documentation, visit `/api-docs` on the running server.

## Web Interface

The web interface provides easy access to all features:

1. **Log Viewer**: 
   - List available log files
   - Stream selected log in real-time
2. **File Editor**:
   - List editable files
   - Edit files using Monaco Editor
3. **Server Health**: View detailed server health information
4. **Command Execution**: Run commands on the server and view output

## Configuration

The following environment variables can be used to configure the server:

- `PORT`: The port number for the server (default: 3000)
- `ZUPPORT_LOG_DIR`: Directory containing log files (default: `<package_root>/logs`)
- `ZUPPORT_EDITABLE_DIR`: Directory containing editable files (default: current working directory)

Note: If `ZUPPORT_LOG_DIR` is not set, the API will look for logs in a `logs` directory within the package root. Make sure this directory exists or create it before running the server.

## Initializing Sample Logs

To help you get started quickly, we've provided a script to initialize the logs directory with sample log files. Here's how to use it:

1. Make sure you're in the root directory of the project.
2. Run the following command to make the script executable:

   ```bash
   chmod +x init_logs.sh
   ```

3. Run the script:

   ```bash
   ./init_logs.sh
   ```

This script will create a `logs` directory (if it doesn't already exist) and populate it with three sample log files:

- `application.log`: Contains general application events.
- `access.log`: Simulates an HTTP access log.
- `error.log`: Contains sample error messages.

These sample logs can be useful for testing the log streaming functionality of the Zupport API.

## Examples

### Fetching Log Files

```javascript
fetch('http://localhost:3000/logs')
  .then(response => response.json())
  .then(data => console.log(data.logs))
  .catch(error => console.error('Error:', error));
```

### Streaming Logs via WebSocket

```javascript
const ws = new WebSocket('ws://localhost:3000/ws?log=application.log');

ws.onmessage = function(event) {
  const logEntry = JSON.parse(event.data);
  console.log(`${logEntry.timestamp}: ${logEntry.message}`);
};
```

### Editing a File

```javascript
fetch('http://localhost:3000/edit-file', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    filePath: 'config.json',
    content: JSON.stringify({ key: 'value' }, null, 2)
  }),
})
.then(response => response.json())
.then(data => console.log(data.message))
.catch(error => console.error('Error:', error));
```

### Checking Server Health

```javascript
fetch('http://localhost:3000/health')
  .then(response => response.json())
  .then(data => {
    console.log(`Uptime: ${data.uptime} seconds`);
    console.log(`Free Memory: ${data.osInfo.freeMem} bytes`);
  })
  .catch(error => console.error('Error:', error));
```

### Executing a Command

```javascript
fetch('http://localhost:3000/execute', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ command: 'echo "Hello, World!"' }),
})
.then(response => response.json())
.then(data => console.log(data.stdout))
.catch(error => console.error('Error:', error));
```
