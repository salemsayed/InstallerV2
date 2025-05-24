/**
 * Server-side debug adapter for the Bareeq application
 * Works with the shared debugging utility
 */

// Import types from shared debug module
import { DebugCategory, DebugLevel } from '../shared/debug';

// Environment variables for debug configuration
const DEBUG_ENABLED = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';
const DEBUG_LEVEL = (process.env.DEBUG_LEVEL || 'info') as DebugLevel;
const DEBUG_CATEGORIES = process.env.DEBUG_CATEGORIES ? 
  process.env.DEBUG_CATEGORIES.split(',').map(c => c.trim()) : 
  ['all', 'auth', 'badge', 'scan', 'api', 'db'];

// Configuration object
const config = {
  enabled: DEBUG_ENABLED,
  level: DEBUG_LEVEL,
  categories: {
    all: DEBUG_CATEGORIES.includes('all'),
    auth: DEBUG_CATEGORIES.includes('auth'),
    badge: DEBUG_CATEGORIES.includes('badge'),
    scan: DEBUG_CATEGORIES.includes('scan'),
    api: DEBUG_CATEGORIES.includes('api'),
    db: DEBUG_CATEGORIES.includes('db')
  }
};

// Level priority
const levelPriority: Record<DebugLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  verbose: 4
};

/**
 * Check if debugging is enabled for a specific category
 */
function isEnabled(category: DebugCategory = 'all'): boolean {
  if (!config.enabled) return false;
  return config.categories.all || config.categories[category] || false;
}

/**
 * Format message with category prefix
 */
function formatMessage(message: string, category: DebugCategory): string {
  return `[${category.toUpperCase()}] ${message}`;
}

/**
 * Log a message if debugging is enabled for the category
 */
export function log(message: string, category: DebugCategory = 'all', level: DebugLevel = 'info'): void {
  if (!isEnabled(category)) return;
  
  // Skip logs with lower priority than current level
  if (levelPriority[level] > levelPriority[config.level]) return;
  
  const formattedMessage = formatMessage(message, category);
  
  switch (level) {
    case 'error':
      console.error(formattedMessage);
      break;
    case 'warn':
      console.warn(formattedMessage);
      break;
    case 'debug':
      console.debug(formattedMessage);
      break;
    case 'verbose':
      console.log(`VERBOSE: ${formattedMessage}`);
      break;
    default:
      console.log(formattedMessage);
      break;
  }
}

// Convenience methods for different log levels
export function error(message: string, category: DebugCategory = 'all'): void {
  log(message, category, 'error');
}

export function warn(message: string, category: DebugCategory = 'all'): void {
  log(message, category, 'warn');
}

export function info(message: string, category: DebugCategory = 'all'): void {
  log(message, category, 'info');
}

export function debug(message: string, category: DebugCategory = 'all'): void {
  log(message, category, 'debug');
}

export function verbose(message: string, category: DebugCategory = 'all'): void {
  log(message, category, 'verbose');
}