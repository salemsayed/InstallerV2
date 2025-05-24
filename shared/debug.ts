/**
 * Debug utility for the Bareeq application
 * Provides centralized control for debug output in different environments
 */

// Debug categories
export type DebugCategory = 
  | 'auth'        // Authentication related logs
  | 'badge'       // Badge system logs
  | 'scan'        // QR/OCR scanning logs
  | 'api'         // API request/response logs
  | 'db'          // Database operations
  | 'all';        // All categories

// Debug levels
export type DebugLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose';

interface DebugConfig {
  enabled: boolean;
  level: DebugLevel;
  categories: {
    [key in DebugCategory]?: boolean;
  };
}

class DebugService {
  private config: DebugConfig;
  
  constructor() {
    // Default configuration
    this.config = {
      enabled: import.meta.env.DEV || false,
      level: 'info',
      categories: {
        all: true,
        auth: true,
        badge: true,
        scan: true,
        api: true,
        db: true
      }
    };
    
    // Initialize from environment variables if available
    this.initFromEnv();
  }
  
  /**
   * Initialize debug configuration from environment variables
   */
  private initFromEnv() {
    // Enable/disable debugging globally
    if (typeof import.meta.env.VITE_DEBUG !== 'undefined') {
      this.config.enabled = import.meta.env.VITE_DEBUG === 'true';
    }
    
    // Set debug level
    if (typeof import.meta.env.VITE_DEBUG_LEVEL !== 'undefined') {
      const level = import.meta.env.VITE_DEBUG_LEVEL as DebugLevel;
      if (['error', 'warn', 'info', 'debug', 'verbose'].includes(level)) {
        this.config.level = level;
      }
    }
    
    // Enable/disable specific categories
    const categories = import.meta.env.VITE_DEBUG_CATEGORIES as string;
    if (categories) {
      // Disable all categories first
      Object.keys(this.config.categories).forEach(cat => {
        this.config.categories[cat as DebugCategory] = false;
      });
      
      // Enable only specified categories
      const enabledCategories = categories.split(',').map(c => c.trim());
      enabledCategories.forEach(category => {
        if (category === 'all') {
          Object.keys(this.config.categories).forEach(cat => {
            this.config.categories[cat as DebugCategory] = true;
          });
        } else if (category in this.config.categories) {
          this.config.categories[category as DebugCategory] = true;
        }
      });
    }
  }
  
  /**
   * Check if debugging is enabled for a specific category
   */
  isEnabled(category: DebugCategory = 'all'): boolean {
    if (!this.config.enabled) return false;
    return this.config.categories.all || this.config.categories[category] || false;
  }
  
  /**
   * Enable or disable debugging for a specific category
   */
  setEnabled(enabled: boolean, category: DebugCategory = 'all') {
    if (category === 'all') {
      Object.keys(this.config.categories).forEach(cat => {
        this.config.categories[cat as DebugCategory] = enabled;
      });
    } else {
      this.config.categories[category] = enabled;
    }
  }
  
  /**
   * Set the global debug state
   */
  setGlobalEnabled(enabled: boolean) {
    this.config.enabled = enabled;
  }
  
  /**
   * Get the current debug configuration
   */
  getConfig(): DebugConfig {
    return { ...this.config };
  }
  
  /**
   * Log a message if debugging is enabled for the category
   */
  log(message: string, category: DebugCategory = 'all', level: DebugLevel = 'info') {
    if (!this.isEnabled(category)) return;
    
    // Skip logs with lower priority than current level
    const levels = { error: 0, warn: 1, info: 2, debug: 3, verbose: 4 };
    if (levels[level] > levels[this.config.level]) return;
    
    const prefix = `[${category.toUpperCase()}]`;
    
    switch (level) {
      case 'error':
        console.error(prefix, message);
        break;
      case 'warn':
        console.warn(prefix, message);
        break;
      case 'debug':
        console.debug(prefix, message);
        break;
      case 'verbose':
        console.log(`${prefix} VERBOSE:`, message);
        break;
      default:
        console.log(prefix, message);
        break;
    }
  }
  
  // Convenience methods for different log levels
  error(message: string, category: DebugCategory = 'all') {
    this.log(message, category, 'error');
  }
  
  warn(message: string, category: DebugCategory = 'all') {
    this.log(message, category, 'warn');
  }
  
  info(message: string, category: DebugCategory = 'all') {
    this.log(message, category, 'info');
  }
  
  debug(message: string, category: DebugCategory = 'all') {
    this.log(message, category, 'debug');
  }
  
  verbose(message: string, category: DebugCategory = 'all') {
    this.log(message, category, 'verbose');
  }
}

// Create a singleton instance
export const debugService = new DebugService();

// Export a simple log function that can be imported and used directly
export function debug(message: string, category: DebugCategory = 'all', level: DebugLevel = 'info') {
  debugService.log(message, category, level);
}