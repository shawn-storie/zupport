#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Zupport API setup...${NC}"

# Function to check if a command succeeded
check_status() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $1${NC}"
    else
        echo -e "${RED}✗ $1 failed${NC}"
        exit 1
    fi
}

# Install Node.js and npm
echo "Installing Node.js and npm..."
sudo dnf install -y nodejs npm
check_status "Node.js and npm installation"

# Install development tools and cargo
echo "Installing development tools and cargo..."
sudo dnf groupinstall -y "Development Tools"
sudo dnf install -y cargo
check_status "Development tools installation"

# Install websocat using cargo
echo "Installing websocat..."
cargo install websocat
check_status "Websocat installation"

# Add cargo binaries to PATH
echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
check_status "PATH configuration"

# Install screen for background processes
echo "Installing screen..."
sudo dnf install -y screen
check_status "Screen installation"

# Create logs directory
echo "Creating logs directory..."
mkdir -p logs
chmod 755 logs
check_status "Logs directory setup"

# Install npm dependencies
echo "Installing npm dependencies..."
npm install
check_status "npm dependencies installation"

# Generate version file
echo "Generating version.js..."
npm run generate-version
check_status "Version file generation"

# Make test script executable
echo "Making test script executable..."
chmod +x test-api.sh
check_status "Test script permissions"

# Create a screen session and start the server
echo "Starting server in screen session..."
screen -dmS zupport bash -c 'node server.js'
check_status "Server startup"

# Wait for server to start
echo "Waiting for server to start..."
sleep 5

# Run tests
echo "Running tests..."
./test-api.sh
check_status "Initial tests"

echo -e "\n${GREEN}Setup completed successfully!${NC}"
echo -e "\nUseful commands:"
echo -e "- View server logs: ${GREEN}screen -r zupport${NC}"
echo -e "- Detach from screen: ${GREEN}Ctrl+A, then D${NC}"
echo -e "- Run tests again: ${GREEN}./test-api.sh${NC}"
echo -e "- Stop server: ${GREEN}screen -X -S zupport quit${NC}" 