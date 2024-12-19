const fs = require('fs').promises;
const path = require('path');

function generateFishtag() {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
    const random = Math.random().toString(36).substring(2, 7);
    return `${timestamp}-${random}`;
}

function generateThread() {
    const prefixes = ["http-nio", "exec", "async", "pool"];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const number = Math.floor(Math.random() * 20) + 1;
    return `${prefix}-thread-${number}`;
}

async function* generateLogs() {
    const LEVEL = ["INFO", "WARN", "ERROR", "DEBUG", "TRACE"];
    const COMPONENT = ["UserController", "AuthService", "DataRepository", "SecurityFilter", "CacheManager"];
    const MSG = [
        "Processing request for user authentication",
        "Database connection pool status: active=5, idle=3",
        "Cache hit ratio: 85.5%",
        "Request validation failed: invalid token",
        `Successfully processed transaction ID: TXN-${Math.random().toString(36).substring(7)}`,
        "Memory usage threshold warning: 85% utilized",
        "Failed to connect to remote service: timeout",
        `User session expired for ID: USR-${Math.random().toString(36).substring(7)}`
    ];

    while (true) {
        const level = LEVEL[Math.floor(Math.random() * LEVEL.length)];
        const component = COMPONENT[Math.floor(Math.random() * COMPONENT.length)];
        const msg = MSG[Math.floor(Math.random() * MSG.length)];
        const fishtag = generateFishtag();
        const thread = generateThread();
        
        const logLine = `${new Date().toISOString()} [${fishtag}] [${thread}] ${level} ${component} - ${msg}\n`;
        yield logLine;
        
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

module.exports = { generateLogs }; 