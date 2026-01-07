/**
 * Console Streaming Utility
 * 
 * Monkey-patches console methods to stream logs to WebSocket server
 * while preserving normal DevTools logging.
 * 
 * Usage: Import this file in your app entry point (main.jsx)
 */

let ws = null;
let isEnabled = true;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 2000;

function connect() {
  if (!isEnabled) return;
  
  try {
    ws = new WebSocket('ws://localhost:7777');
    
    ws.onopen = () => {
      reconnectAttempts = 0;
      console.log('%c📡 Console streaming connected', 'color: #10b981; font-weight: bold');
    };
    
    ws.onerror = () => {
      // Silent fail - don't spam console if server isn't running
    };
    
    ws.onclose = () => {
      if (isEnabled && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        setTimeout(connect, RECONNECT_DELAY);
      }
    };
  } catch (err) {
    // Ignore connection errors
  }
}

function sendLog(level, message, args = [], stack = null) {
  if (!isEnabled || !ws || ws.readyState !== WebSocket.OPEN) return;
  
  try {
    ws.send(JSON.stringify({
      level,
      message,
      args: args.map(arg => {
        try {
          if (typeof arg === 'object') {
            return JSON.stringify(arg, null, 2);
          }
          return String(arg);
        } catch {
          return '[Object]';
        }
      }),
      timestamp: new Date().toISOString(),
      stack
    }));
  } catch (err) {
    // Ignore send errors
  }
}

// Store original console methods
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;
const originalInfo = console.info;
const originalDebug = console.debug;

// Monkey-patch console methods
console.log = function(...args) {
  originalLog.apply(console, args);
  sendLog('log', args[0] || '', args.slice(1));
};

console.error = function(...args) {
  originalError.apply(console, args);
  const stack = new Error().stack;
  sendLog('error', args[0] || '', args.slice(1), stack);
};

console.warn = function(...args) {
  originalWarn.apply(console, args);
  sendLog('warn', args[0] || '', args.slice(1));
};

console.info = function(...args) {
  originalInfo.apply(console, args);
  sendLog('info', args[0] || '', args.slice(1));
};

console.debug = function(...args) {
  originalDebug.apply(console, args);
  sendLog('debug', args[0] || '', args.slice(1));
};

// Toggle function
function toggleConsoleStream(enabled) {
  isEnabled = enabled;
  if (enabled && (!ws || ws.readyState === WebSocket.CLOSED)) {
    connect();
  } else if (!enabled && ws) {
    ws.close();
  }
  console.log(`Console streaming ${enabled ? 'enabled' : 'disabled'}`);
}

// Also expose on window for global access
if (typeof window !== 'undefined') {
  window.toggleConsoleStream = toggleConsoleStream;
  // Auto-connect on load
  connect();
}

// Export for manual control
export { connect, toggleConsoleStream };
