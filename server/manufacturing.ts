import knex from 'knex';
import { logSqlSafely, logResultSafely, logErrorSafely } from './utils/secure-logger';

console.log('[MANUFACTURING_DB] Initializing connection to external manufacturing database');

// Create manufacturing database connection
export const manufacturingDb = knex({
  client: 'pg',
  connection: {
    host: process.env.MANUFACTURING_DB_HOST,
    port: parseInt(process.env.MANUFACTURING_DB_PORT),
    user: process.env.MANUFACTURING_DB_USER,
    password: process.env.MANUFACTURING_DB_PASSWORD,
    database: process.env.MANUFACTURING_DB_NAME,
    ssl: { rejectUnauthorized: false }
  },
  pool: { 
    min: 0, 
    max: 7,
    // Add event handlers for connection issues
    afterCreate: (conn: any, done: Function) => {
      console.log('[MANUFACTURING_DB] New connection established');
      done(null, conn);
    }
  },
  // Enable query debugging
  debug: true,
  // Log queries
  log: {
    warn(message: string) {
      console.log('[MANUFACTURING_DB] Warning:', message);
    },
    error(message: string) {
      console.error('[MANUFACTURING_DB] Error:', message);
    },
    deprecate(message: string) {
      console.log('[MANUFACTURING_DB] Deprecated:', message);
    },
    debug(message: string) {
      console.log('[MANUFACTURING_DB] Debug:', message);
    },
  }
});

// Test connection on startup
manufacturingDb.raw('SELECT 1')
  .then(() => {
    console.log('[MANUFACTURING_DB] Connection test successful');
    // Get table information
    return manufacturingDb.raw("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  })
  .then((result) => {
    console.log('[MANUFACTURING_DB] Available tables:', result.rows.map((r: any) => r.table_name));
    // Check po_items table structure
    return manufacturingDb.raw("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'po_items'");
  })
  .then((result) => {
    console.log('[MANUFACTURING_DB] po_items table structure:', result.rows);
  })
  .catch(err => {
    console.error('[MANUFACTURING_DB] Connection test failed:', err);
  });

// Function to check if a serial number exists in the manufacturing database
export async function checkSerialNumber(serialNumber: string): Promise<boolean> {
  console.log(`[MANUFACTURING_DB] Checking serial number (ID length: ${serialNumber.length})`);
  
  try {
    // Using the recommended EXISTS query approach for efficiency
    console.log(`[MANUFACTURING_DB] Using EXISTS query`);
    
    const sql = `
      SELECT EXISTS (
        SELECT 1
        FROM po_items
        WHERE serial_number = ?
      ) AS po_item_exists
    `;
    
    // Use secure logging without exposing parameters
    logSqlSafely('CHECK_SERIAL', sql, [serialNumber]);
    
    const result = await manufacturingDb.raw(sql, [serialNumber]);
    
    // Safely log query results
    logResultSafely('CHECK_SERIAL', result);
    
    // For Postgres, the result format is different from other SQL engines
    // It returns an array with objects, we need to extract the boolean value from it
    if (result && result.rows && result.rows.length > 0) {
      const exists = result.rows[0].po_item_exists === true;
      console.log(`[MANUFACTURING_DB] Item exists: ${exists}`);
      
      if (exists) return true;
    } else {
      console.log(`[MANUFACTURING_DB] Unexpected result format or no result, checking fallbacks`);
    }
    
    // Fallback to direct query if the EXISTS approach didn't work
    console.log(`[MANUFACTURING_DB] Fallback: Direct select query`);
    
    const fallbackQuery = manufacturingDb('po_items')
      .select('serial_number')
      .where('serial_number', serialNumber)
      .limit(1);
    
    // Log the SQL query template without parameters
    logSqlSafely('CHECK_SERIAL_FALLBACK', 'SELECT serial_number FROM po_items WHERE serial_number = ? LIMIT 1', [serialNumber]);
    
    const fallbackResult = await fallbackQuery;
    logResultSafely('CHECK_SERIAL_FALLBACK', fallbackResult);
    
    if (fallbackResult && fallbackResult.length > 0) {
      console.log(`[MANUFACTURING_DB] Found via fallback query (result count: ${fallbackResult.length})`);
      return true;
    }
    
    // Check for any entry with the printed_url containing our UUID (in case it's stored as part of URL)
    console.log(`[MANUFACTURING_DB] Final check: Look for UUID in printed_url`);
    
    const urlQuery = manufacturingDb('po_items')
      .select('serial_number')
      .whereRaw('printed_url LIKE ?', [`%${serialNumber}%`])
      .limit(1);
    
    // Log the URL check SQL template without parameters
    logSqlSafely('CHECK_SERIAL_URL', 'SELECT serial_number FROM po_items WHERE printed_url LIKE ? LIMIT 1', [`%${serialNumber}%`]);
    
    const urlResult = await urlQuery;
    logResultSafely('CHECK_SERIAL_URL', urlResult);
    
    return urlResult && urlResult.length > 0;
  } catch (error) {
    // Use secure error logging
    logErrorSafely('CHECK_SERIAL', error);
    
    // Additional connection debugging without exposing sensitive data
    try {
      console.log('[MANUFACTURING_DB] Testing database connection...');
      await manufacturingDb.raw('SELECT 1 as connection_test');
      console.log('[MANUFACTURING_DB] Database connection is working');
    } catch (connError) {
      logErrorSafely('CONNECTION_TEST', connError);
    }
    
    return false;
  }
}

// Function to get product name by serial number
import { logSqlSafely, logResultSafely, logErrorSafely } from './utils/secure-logger';

export async function getProductNameBySerialNumber(serialNumber: string): Promise<string | null> {
  console.log(`[MANUFACTURING_DB] Getting product name for serial number (ID length: ${serialNumber.length})`);
  
  try {
    // Simplified approach with direct SQL query
    console.log(`[MANUFACTURING_DB] Using direct SQL query to get product name`);
    
    const sql = `
      SELECT p.name as product_name
      FROM po_items pi
      JOIN products p ON p.pid = pi.product_id
      WHERE pi.serial_number = ?
      LIMIT 1
    `;
    
    // Use secure logging without exposing the actual serial number
    logSqlSafely('GET_PRODUCT', sql, [serialNumber]);
    
    const result = await manufacturingDb.raw(sql, [serialNumber]);
    
    // Safely log the query result structure without exposing data
    logResultSafely('GET_PRODUCT', result);
    
    // For Postgres, the result format is different from other SQL engines
    if (result && result.rows && result.rows.length > 0) {
      const productName = result.rows[0].product_name;
      console.log(`[MANUFACTURING_DB] Found product name (length: ${productName ? productName.length : 0})`);
      return productName;
    }
    
    // Fallback: Try to get product by searching printed_url
    console.log(`[MANUFACTURING_DB] Fallback: Search by printed_url`);
    
    const fallbackSql = `
      SELECT p.name as product_name
      FROM po_items pi
      JOIN products p ON p.pid = pi.product_id
      WHERE pi.printed_url LIKE ?
      LIMIT 1
    `;
    
    // Log safely without exposing the serial number
    logSqlSafely('GET_PRODUCT_FALLBACK', fallbackSql, [`%${serialNumber}%`]);
    
    const fallbackResult = await manufacturingDb.raw(fallbackSql, [`%${serialNumber}%`]);
    
    // Safely log the result structure
    logResultSafely('GET_PRODUCT_FALLBACK', fallbackResult);
    
    if (fallbackResult && fallbackResult.rows && fallbackResult.rows.length > 0) {
      const productName = fallbackResult.rows[0].product_name;
      console.log(`[MANUFACTURING_DB] Found product name via fallback (length: ${productName ? productName.length : 0})`);
      return productName;
    }
    
    // Final attempt: directly query the po_items table to get product_id
    console.log(`[MANUFACTURING_DB] Final attempt: Get product_id directly from po_items`);
    
    const itemQuery = `SELECT product_id FROM po_items WHERE serial_number = ? LIMIT 1`;
    logSqlSafely('GET_PRODUCT_ID', itemQuery, [serialNumber]);
    
    const itemResult = await manufacturingDb.raw(itemQuery, [serialNumber]);
    logResultSafely('GET_PRODUCT_ID', itemResult);
    
    if (itemResult && itemResult.rows && itemResult.rows.length > 0 && itemResult.rows[0].product_id) {
      const productId = itemResult.rows[0].product_id;
      console.log(`[MANUFACTURING_DB] Found product_id (not showing actual ID)`);
      
      // Get product name directly
      const productQuery = `SELECT name FROM products WHERE pid = ? LIMIT 1`;
      logSqlSafely('GET_PRODUCT_BY_ID', productQuery, [productId]);
      
      const productResult = await manufacturingDb.raw(productQuery, [productId]);
      logResultSafely('GET_PRODUCT_BY_ID', productResult);
      
      if (productResult && productResult.rows && productResult.rows.length > 0) {
        return productResult.rows[0].name;
      }
    }
    
    console.log(`[MANUFACTURING_DB] Could not find product name for the provided serial number`);
    return null;
  } catch (error) {
    logErrorSafely('GET_PRODUCT_NAME', error);
    return null;
  }
}