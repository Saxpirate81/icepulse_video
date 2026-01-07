#!/usr/bin/env node

import { WebSocketServer } from 'ws';

const PORT = 7777;
const wss = new WebSocketServer({ port: PORT });

console.log(`📡 Log server listening on ws://localhost:${PORT}`);
console.log('Waiting for browser connections...\n');

wss.on('connection', (ws) => {
  console.log('✅ Browser connected\n');
  
  ws.on('message', (data) => {
    try {
      const log = JSON.parse(data.toString());
      const { level, message, args, timestamp, stack } = log;
      
      const time = new Date(timestamp).toLocaleTimeString();
      const prefix = `[${time}]`;
      
      switch (level) {
        case 'error':
          console.error(`${prefix} ❌`, message, ...(args || []));
          if (stack) console.error(stack);
          break;
        case 'warn':
          console.warn(`${prefix} ⚠️`, message, ...(args || []));
          break;
        case 'info':
          console.info(`${prefix} ℹ️`, message, ...(args || []));
          break;
        case 'debug':
          console.debug(`${prefix} 🔍`, message, ...(args || []));
          break;
        default:
          console.log(`${prefix} 📝`, message, ...(args || []));
      }
    } catch (err) {
      console.error('Failed to parse log:', err.message);
    }
  });
  
  ws.on('close', () => {
    console.log('\n❌ Browser disconnected\n');
  });
  
  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
});

process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down log server...');
  wss.close(() => {
    process.exit(0);
  });
});
