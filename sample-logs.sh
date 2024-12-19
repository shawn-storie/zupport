#!/bin/bash

# Function to generate random fishtag
generate_fishtag() {
    # Format: YYYYMMDD-HHMMSS-XXXXX where X is random alphanumeric
    local timestamp=$(date '+%Y%m%d-%H%M%S')
    local random=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 5 | head -n 1)
    echo "$timestamp-$random"
}

# Function to generate random thread name
generate_thread() {
    local prefixes=("http-nio" "exec" "async" "pool")
    local prefix=${prefixes[$RANDOM % ${#prefixes[@]}]}
    local number=$((RANDOM % 20 + 1))
    echo "$prefix-thread-$number"
}

while true; do
    LEVEL=("INFO" "WARN" "ERROR" "DEBUG" "TRACE")
    COMPONENT=("UserController" "AuthService" "DataRepository" "SecurityFilter" "CacheManager")
    MSG=(
        "Processing request for user authentication"
        "Database connection pool status: active=5, idle=3"
        "Cache hit ratio: 85.5%"
        "Request validation failed: invalid token"
        "Successfully processed transaction ID: TXN-${RANDOM}"
        "Memory usage threshold warning: 85% utilized"
        "Failed to connect to remote service: timeout"
        "User session expired for ID: USR-${RANDOM}"
    )

    L=${LEVEL[$RANDOM % ${#LEVEL[@]}]}
    C=${COMPONENT[$RANDOM % ${#COMPONENT[@]}]}
    M=${MSG[$RANDOM % ${#MSG[@]}]}
    F=$(generate_fishtag)
    T=$(generate_thread)
    
    # Format: YYYY-MM-DDThh:mm:ss.SSS [fishtag] [thread] LEVEL component - message
    echo "$(date '+%Y-%m-%dT%H:%M:%S.%3N') [$F] [$T] $L $C - $M" >> /var/log/tomcat9/not-catalina.out
    
    sleep 0.5
done 