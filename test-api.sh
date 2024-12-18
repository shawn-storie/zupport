#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Base URL
BASE_URL="http://localhost:3000"

echo "Installing websocat if not present..."
if ! command -v websocat &> /dev/null; then
    # For Amazon Linux 2023
    sudo dnf install -y cargo
    cargo install websocat
fi

# Function to test an endpoint
test_endpoint() {
    local endpoint=$1
    local expected_status=$2
    local description=$3

    echo -e "\nTesting ${description}..."
    
    response=$(curl -s -w "\n%{http_code}" ${BASE_URL}${endpoint})
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$status" -eq "$expected_status" ]; then
        echo -e "${GREEN}✓ Success${NC} (Status: $status)"
        echo "Response: $body"
    else
        echo -e "${RED}✗ Failed${NC} (Expected: $expected_status, Got: $status)"
        echo "Response: $body"
    fi
}

# Function to test POST endpoints
test_post_endpoint() {
    local endpoint=$1
    local data=$2
    local expected_status=$3
    local description=$4

    echo -e "\nTesting ${description}..."
    
    response=$(curl -s -w "\n%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d "$data" \
        ${BASE_URL}${endpoint})
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$status" -eq "$expected_status" ]; then
        echo -e "${GREEN}✓ Success${NC} (Status: $status)"
        echo "Response: $body"
    else
        echo -e "${RED}✗ Failed${NC} (Expected: $expected_status, Got: $status)"
        echo "Response: $body"
    fi
}

echo "Starting API tests..."

# Test health endpoint
test_endpoint "/health" 200 "Health Check"

# Test version endpoint
test_endpoint "/version" 200 "Version Check"

# Test logs endpoint
test_endpoint "/logs" 200 "Logs List"

# Test editable files endpoint
test_endpoint "/editable-files" 200 "Editable Files List"

# Test server stats endpoint
test_endpoint "/server-stats" 200 "Server Stats"

# Test command execution
test_post_endpoint "/execute" '{"command":"uptime"}' 200 "Command Execution (uptime)"

# Test file editing (create a test file first)
echo "test content" > test.txt
test_post_endpoint "/edit-file" \
    '{"filePath":"test.txt","content":"updated content"}' \
    200 "File Editing"

# Test WebSocket log streaming
echo -e "\nTesting WebSocket log streaming..."
echo "Connecting to WebSocket for 5 seconds..."
timeout 5 websocat "ws://localhost:3000/ws?log=combined.log" || echo "WebSocket test completed"

# Clean up
rm -f test.txt

echo -e "\nTests completed!" 