# Zupport API Test Script

This script provides a comprehensive test suite for the Zupport API, testing all major endpoints including HTTP endpoints and WebSocket connections.

## Prerequisites

- Bash shell
- curl (usually pre-installed)
- Node.js server running on port 3000
- Amazon Linux 2023 (for automatic websocat installation)

## Installation

1. Make the script executable:
```bash
chmod +x test-api.sh
```

2. The script will automatically install `websocat` if it's not present. However, if you want to install dependencies manually:
```bash
# Install development tools
sudo dnf groupinstall "Development Tools"

# Install cargo (Rust package manager)
sudo dnf install -y cargo

# Install websocat
cargo install websocat
```

## Usage

1. Ensure the Zupport API server is running:
```bash
# Start the server in background
node server.js &

# Note the process ID if you need to stop it later
echo $!
```

2. Run the test script:
```bash
./test-api.sh
```

## What Gets Tested

The script tests the following endpoints:

### GET Endpoints
- `/health` - Server health check
- `/version` - API version information
- `/logs` - Available log files
- `/editable-files` - List of editable files
- `/server-stats` - Server statistics

### POST Endpoints
- `/execute` - Command execution (tests with `uptime` command)
- `/edit-file` - File editing functionality

### WebSocket
- `/ws` - WebSocket connection for log streaming (tests with combined.log)

## Output

The script provides colored output for better visibility:
- 🟢 Green: Successful tests
- 🔴 Red: Failed tests

Each test shows:
- Test description
- HTTP status code
- Response body
- Any errors (if applicable)

Example output:
```
Testing Health Check...
✓ Success (Status: 200)
Response: {"status":"healthy","uptime":123.45,"timestamp":"2024-01-01T00:00:00.000Z"}
```

## Troubleshooting

1. If the server isn't running:
```
Failed (Expected: 200, Got: 000)
Response: curl: (7) Failed to connect to localhost port 3000
```
Solution: Start the Node.js server first

2. If websocat installation fails:
```
error: could not install websocat
```
Solution: Try installing manually with the commands in the Installation section

3. If permission denied:
```
bash: ./test-api.sh: Permission denied
```
Solution: Run `chmod +x test-api.sh`

## Cleanup

The script automatically:
- Removes any test files created during testing
- Closes WebSocket connections
- Provides a completion message

## Environment Variables

You can modify the `BASE_URL` variable in the script if your server runs on a different host or port:
```bash
# Base URL
BASE_URL="http://localhost:3000"
```

## Adding New Tests

To add a new GET endpoint test:
```bash
test_endpoint "/your-endpoint" expected_status "Description"
```

To add a new POST endpoint test:
```bash
test_post_endpoint "/your-endpoint" '{"key":"value"}' expected_status "Description"
```

## License

This test script is part of the Zupport API project and is licensed under the same terms as the main project. 