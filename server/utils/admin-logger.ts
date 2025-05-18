import { redactSensitiveInfo } from '../index';

/**
 * Creates a safe logging function for admin operations
 * @param operation The type of admin operation being performed
 * @returns A function that logs admin operations safely
 */
export function createAdminLogger(operation: string) {
  return {
    /**
     * Logs admin operation info with sensitive data redacted
     * @param message Description of what's being logged
     * @param data Optional data to log (will be redacted)
     */
    info: (message: string, data?: any) => {
      if (data) {
        console.log(`[ADMIN:${operation}] ${message}`, 
          typeof data === 'object' ? 
            JSON.stringify(redactSensitiveInfo(data)) : 
            data
        );
      } else {
        console.log(`[ADMIN:${operation}] ${message}`);
      }
    },
    
    /**
     * Logs admin operation errors with sensitive data redacted
     * @param message Error description
     * @param error Optional error object
     */
    error: (message: string, error?: any) => {
      if (error) {
        // Extract just the essential error info without potential sensitive data
        const safeError = {
          message: error.message || 'Unknown error',
          code: error.code,
          name: error.name,
        };
        
        console.error(`[ADMIN:${operation}] ${message}`, JSON.stringify(safeError));
      } else {
        console.error(`[ADMIN:${operation}] ${message}`);
      }
    },
    
    /**
     * Logs successful admin operation completion
     * @param entityType Type of entity being managed
     * @param entityId ID of the entity
     * @param action Action performed
     */
    success: (entityType: string, entityId: number | string, action: string) => {
      console.log(`[ADMIN:${operation}] ${action} ${entityType} ID: ${entityId} successful`);
    }
  };
}