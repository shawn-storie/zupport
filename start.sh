#!/bin/bash

# Kill existing screen session if it exists
screen -X -S zupport quit

# Start new screen session with nodemon
screen -dmS zupport bash -c 'nodemon server.js'

# Show status
echo "Server started in screen session 'zupport'"
echo "To view logs: screen -r zupport"
echo "To detach: Ctrl+A, then D"
echo "To stop: screen -X -S zupport quit" 