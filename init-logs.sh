#!/bin/bash

# Script to initialize sample logs for Zupport API

# Set the log directory
LOG_DIR="./logs"

# Create the log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Function to generate a random IP address
generate_ip() {
    echo "$((RANDOM % 256)).$((RANDOM % 256)).$((RANDOM % 256)).$((RANDOM % 256))"
}

# Function to generate a random HTTP status code
generate_status() {
    local codes=(200 201 204 301 302 304 400 401 403 404 500 502 503)
    echo "${codes[$RANDOM % ${#codes[@]}]}"
}

# Function to generate a random user agent
generate_user_agent() {
    local agents=(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15"
        "Mozilla/5.0 (X11; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0"
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59"
        "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1"
    )
    echo "${agents[$RANDOM % ${#agents[@]}]}"
}

# Generate application.log
echo "Generating application.log..."
for i in {1..100}; do
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
    log_level=("INFO" "WARN" "ERROR" "DEBUG")
    echo "[$timestamp] [${log_level[$RANDOM % 4]}] Application event $i occurred" >> "$LOG_DIR/application.log"
done

# Generate access.log
echo "Generating access.log..."
for i in {1..100}; do
    timestamp=$(date -u +"%d/%b/%Y:%H:%M:%S %z")
    ip=$(generate_ip)
    method=("GET" "POST" "PUT" "DELETE")
    path=("/api/users" "/api/products" "/api/orders" "/api/auth" "/api/settings")
    status=$(generate_status)
    size=$((RANDOM % 10000 + 100))
    user_agent=$(generate_user_agent)
    echo "$ip - - [$timestamp] \"${method[$RANDOM % 4]} ${path[$RANDOM % 5]} HTTP/1.1\" $status $size \"$user_agent\"" >> "$LOG_DIR/access.log"
done

# Generate error.log
echo "Generating error.log..."
for i in {1..50}; do
    timestamp=$(date -u +"%Y-%m-%d %H:%M:%S")
    error_types=("RuntimeError" "ValueError" "TypeError" "IndexError" "KeyError")
    echo "[$timestamp] [ERROR] ${error_types[$RANDOM % 5]}: An error occurred during operation $i" >> "$LOG_DIR/error.log"
done

echo "Sample logs have been generated in the $LOG_DIR directory."
