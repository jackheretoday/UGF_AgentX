import { config } from '../config/env.js';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const colors = {
  reset: '\x1b[0m',
  info: '\x1b[36m', // cyan
  warn: '\x1b[33m', // yellow
  error: '\x1b[31m', // red
  debug: '\x1b[35m', // magenta
};

function log(level: LogLevel, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const color = colors[level];
  const prefix = `${color}[${level.toUpperCase()}]${colors.reset} ${timestamp}`;

  if (data) {
    console.log(`${prefix} ${message}`, data);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

export const logger = {
  info: (message: string, data?: any) => log('info', message, data),
  warn: (message: string, data?: any) => log('warn', message, data),
  error: (message: string, data?: any) => log('error', message, data),
  debug: (message: string, data?: any) => config.isDev && log('debug', message, data),
};
