# Zupport API

Zupport API is a comprehensive Node.js-based solution for log streaming, file editing, server health monitoring, and command execution. It provides both a RESTful API and a web interface for easy interaction.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Web Interface](#web-interface)
- [Configuration](#configuration)
- [Logging](#logging)
- [Testing](#testing)
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
- Winston-based logging with customizable log levels
- Automated testing with Jest and Supertest

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/shawn-storie/zupport.git
   cd zupport
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
   export LOG_LEVEL=info
   ```

4. Start the server:
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
- `ZUPPORT_LOG_DIR`: Directory containing log files (default: `<project_root>/logs`)
- `ZUPPORT_EDITABLE_DIR`: Directory containing editable files (default: current working directory)
- `LOG_LEVEL`: Logging level (default: 'info')

### Log Levels

The `LOG_LEVEL` environment variable can be set to one of the following values, in order of increasing verbosity:

1. `error`: Only log errors
2. `warn`: Log warnings and errors
3. `info`: Log info, warnings, and errors (default)
4. `http`: Log HTTP requests, info, warnings, and errors
5. `verbose`: Log verbose messages and all of the above
6. `debug`: Log debug messages and all of the above
7. `silly`: Log everything

To set the log level when starting the server, you can use:

```bash
LOG_LEVEL=debug npm start
```

This will run the server with debug-level logging, which includes all log messages.

## Logging

Zupport API uses Winston for logging. Log files are stored in the specified log directory:

- `error.log`: Contains only error-level logs
- `combined.log`: Contains all logs

In non-production environments, logs are also output to the console with color-coding.

To change the log level:

```bash
LOG_LEVEL=debug npm start
```

This will show all logs up to and including debug level. Adjust the `LOG_LEVEL` value as needed for your desired level of logging detail.

## Testing

Zupport API uses Jest for unit and integration testing, along with Supertest for API testing.

### Test Location

Test files are located in the `__tests__` directory in the project root. Each test file typically corresponds to a feature or a group of related features.

### Running Tests

To run all tests:

```bash
npm test
```

To run tests with coverage report:

```bash
npm run test:coverage
```

This will generate a coverage report in the `coverage` directory.

### Writing Tests

When adding new features or modifying existing ones, make sure to update or add corresponding tests in the `__tests__` directory. Follow the existing test patterns and use Jest's assertion methods to verify expected behaviors.

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

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
