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
- [Version Management](#version-management)
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
- Server stats viewing with HTMX integration, including disk usage
- API version endpoint

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
   export PORT=4111
   export LOG_LEVEL=info
   export CONSOLE_LOGGING=true
   ```

4. Start the server:
   ```bash
   npm start
   ```

## Usage

After starting the server, you can access:
- Web interface: `http://localhost:4111`
- API Documentation: `http://localhost:4111/api-docs`
- Health Check: `http://localhost:4111/health`

For programmatic access, you can use the API endpoints directly. Refer to the [API Endpoints](#api-endpoints) section for details.

## API Endpoints

- `GET /logs`: Retrieve a list of available log files
- `GET /log-stream`: Stream a specific log file in real-time (WebSocket)
- `GET /editable-files`: Get a list of editable files
- `GET /file-content`: Retrieve the content of a specific file
- `POST /edit-file`: Edit a file
- `GET /health`: Get server health information
- `POST /execute`: Execute a command on the server
- `GET /server-stats`: Get detailed server statistics including disk usage (supports both JSON and HTMX responses)
- `GET /version`: Get the current API version (supports both JSON and HTMX responses)

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
5. **Server Stats**: View real-time server statistics using HTMX

## Configuration

The following environment variables can be used to configure the server:

- `PORT`: The port number for the server (default: 4111)
- `ZUPPORT_LOG_DIR`: Directory containing log files (default: `<project_root>/logs`)
- `ZUPPORT_EDITABLE_DIR`: Directory containing editable files (default: current working directory)
- `LOG_LEVEL`: Logging level (default: 'info')
- `CONSOLE_LOGGING`: Enable console logging even in production (default: 'false' in production, 'true' otherwise)

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

Console logging behavior depends on the environment and configuration:
- In non-production environments, logs are output to the console by default.
- In production, console logging is disabled by default but can be enabled with the `CONSOLE_LOGGING` environment variable.

To change the log level and enable console logging in production:

```bash
LOG_LEVEL=debug CONSOLE_LOGGING=true npm start
```

This will set the log level to debug and enable console logging, even in a production environment.

## Version Management

The Zupport API version is managed in the `package.json` file. A `version.js` file is automatically generated based on this version to ensure consistency across the package. When updating the version:

1. Modify the version in `package.json`
2. Run `npm run generate-version` (this is also automatically run before publishing)
3. Commit these changes with a version bump commit message

This approach ensures that the version is correctly reported even when the package is installed as a dependency in other projects. The `version.js` file is automatically generated before the package is published, ensuring it always matches the version in `package.json`.

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
fetch('http://localhost:4111/logs')
  .then(response => response.json())
  .then(data => console.log(data.logs))
  .catch(error => console.error('Error:', error));
```

### Streaming Logs via WebSocket

```javascript
const ws = new WebSocket('ws://localhost:4111/ws?log=application.log');

ws.onmessage = function(event) {
  const logEntry = JSON.parse(event.data);
  console.log(`${logEntry.timestamp}: ${logEntry.message}`);
};
```

### Editing a File

```javascript
fetch('http://localhost:4111/edit-file', {
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

### Fetching Server Stats

```javascript
fetch('http://localhost:4111/server-stats')
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));
```

### Fetching API Version

```javascript
fetch('http://localhost:4111/version')
  .then(response => response.json())
  .then(data => console.log(data.version))
  .catch(error => console.error('Error:', error));
```

For HTMX integration, simply use the provided links in the web interface, or add the following to your HTML:

```html
<a href="#" hx-get="/server-stats" hx-target="#stats-container" hx-trigger="click">View Server Stats</a>
<div id="stats-container"></div>

<a href="#" hx-get="/version" hx-target="#version-container" hx-trigger="click">View API Version</a>
<div id="version-container"></div>
```

This will fetch and display the server stats and API version when the respective links are clicked, without reloading the page.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
