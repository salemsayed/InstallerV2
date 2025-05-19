/**
 * Safely logs SQL queries by removing sensitive parameters
 * @param operation Type of database operation being performed
 * @param queryText The SQL query text with placeholders (?, $1, etc)
 * @param params Optional parameters that would be bound to the query (these will be redacted)
 */
export function logSqlSafely(operation: string, queryText: string, params?: any[]): void {
  // Don't show the actual parameter values in logs
  const redactedParams = params ? params.map(() => '[REDACTED]') : [];
  
  console.log(`[DB:${operation}] Query with ${redactedParams.length} bound parameter(s): ${queryText}`);
}

/**
 * Safely logs database operation results without exposing raw data
 * @param operation Type of database operation being performed
 * @param result The result object from the database operation
 */
export function logResultSafely(operation: string, result: any): void {
  let logMessage = `[DB:${operation}] Result: `;
  
  if (result === null || result === undefined) {
    logMessage += 'null or undefined';
  } else if (Array.isArray(result)) {
    // For arrays, just log the count and structure of first item (if it exists)
    logMessage += `Array with ${result.length} items`;
    if (result.length > 0) {
      // For the first item, just show the keys, not the values
      const sampleKeys = Object.keys(result[0] || {});
      if (sampleKeys.length > 0) {
        logMessage += ` [Sample keys: ${sampleKeys.join(', ')}]`;
      }
    }
  } else if (typeof result === 'object') {
    // For query results with rows property (pg results)
    if (result.rows && Array.isArray(result.rows)) {
      logMessage += `Result with ${result.rows.length} rows`;
      // Only log structure of first row if it exists
      if (result.rows.length > 0) {
        const sampleKeys = Object.keys(result.rows[0] || {});
        if (sampleKeys.length > 0) {
          logMessage += ` [Sample keys: ${sampleKeys.join(', ')}]`;
        }
      }
    } else {
      // For other objects, log the keys
      const keys = Object.keys(result);
      logMessage += `Object with keys: ${keys.join(', ')}`;
    }
  } else {
    // For primitive types
    logMessage += `${typeof result} value`;
  }
  
  console.log(logMessage);
}

/**
 * Safely logs errors without exposing sensitive data
 * @param operation Type of database operation that failed
 * @param error The error object
 */
export function logErrorSafely(operation: string, error: any): void {
  // Capture stack trace but ensure it doesn't contain query parameters
  let stack = error.stack ? error.stack.toString() : '';
  
  // Redact anything that might be a password, token, or other sensitive info from the stack
  const sensitivePatterns = [
    /password\s*=\s*['"][^'"]*['"]?/gi,
    /token\s*=\s*['"][^'"]*['"]?/gi,
    /secret\s*=\s*['"][^'"]*['"]?/gi,
    /key\s*=\s*['"][^'"]*['"]?/gi,
    /auth\w*\s*=\s*['"][^'"]*['"]?/gi,
    /bearer\s+[a-zA-Z0-9\-_\.]+/gi,
    // Patterns for inline PostgreSQL password strings
    /(['"])postgres:\/\/[^:]+:[^@]+@[^/]+\/[^'"]+\1/g,
    /(['"])postgresql:\/\/[^:]+:[^@]+@[^/]+\/[^'"]+\1/g,
  ];
  
  sensitivePatterns.forEach(pattern => {
    stack = stack.replace(pattern, (match) => {
      // Keep the key part but replace the value part with [REDACTED]
      const keyPart = match.split('=')[0];
      if (keyPart) {
        return `${keyPart}=[REDACTED]`;
      }
      return '[REDACTED]';
    });
  });
  
  // Create a safe error object with redacted info
  const safeError = {
    message: error.message || 'Unknown error',
    code: error.code,
    // Include stack but make sure no sensitive data is there
    stack: stack,
  };

  console.error(`[DB:${operation}] Error:`, JSON.stringify(safeError));
}