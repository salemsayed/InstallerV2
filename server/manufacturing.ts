import knex from 'knex';

console.log('[MANUFACTURING_DB] Initializing connection to external manufacturing database');

// Create manufacturing database connection
export const manufacturingDb = knex({
  client: 'pg',
  connection: {
    host: process.env.MANUFACTURING_DB_HOST || '157.230.125.93',
    port: parseInt(process.env.MANUFACTURING_DB_PORT || '5432'),
    user: process.env.MANUFACTURING_DB_USER || 'bareeq_user',
    password: process.env.MANUFACTURING_DB_PASSWORD,
    database: process.env.MANUFACTURING_DB_NAME || 'manufacturing',
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
  console.log(`[MANUFACTURING_DB] Checking serial number: "${serialNumber}"`);
  
  try {
    // Using the recommended EXISTS query approach for efficiency
    console.log(`[MANUFACTURING_DB] Using EXISTS query with serial_number: "${serialNumber}"`);
    
    const sql = `
      SELECT EXISTS (
        SELECT 1
        FROM po_items
        WHERE serial_number = ?
      ) AS po_item_exists
    `;
    
    console.log(`[MANUFACTURING_DB] Raw SQL query: ${sql.replace('?', `'${serialNumber}'`)}`);
    
    const result = await manufacturingDb.raw(sql, [serialNumber]);
    
    // Debug what was returned
    console.log(`[MANUFACTURING_DB] Query result:`, result);
    
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
    
    console.log(`[MANUFACTURING_DB] Fallback query: ${fallbackQuery.toString()}`);
    
    const fallbackResult = await fallbackQuery;
    console.log(`[MANUFACTURING_DB] Fallback result:`, fallbackResult);
    
    if (fallbackResult && fallbackResult.length > 0) {
      console.log(`[MANUFACTURING_DB] Found via fallback: ${fallbackResult[0].serial_number}`);
      return true;
    }
    
    // Check for any entry with the printed_url containing our UUID (in case it's stored as part of URL)
    console.log(`[MANUFACTURING_DB] Final check: Look for UUID in printed_url`);
    
    const urlQuery = manufacturingDb('po_items')
      .select('serial_number')
      .whereRaw('printed_url LIKE ?', [`%${serialNumber}%`])
      .limit(1);
    
    console.log(`[MANUFACTURING_DB] URL check query: ${urlQuery.toString()}`);
    
    const urlResult = await urlQuery;
    console.log(`[MANUFACTURING_DB] URL check result:`, urlResult);
    
    return urlResult && urlResult.length > 0;
  } catch (error) {
    console.error('[MANUFACTURING_DB] Error checking serial number:', error);
    if (error instanceof Error) {
      console.error(`[MANUFACTURING_DB] Error message: ${error.message}`);
      console.error(`[MANUFACTURING_DB] Error stack: ${error.stack}`);
    }
    
    // Additional connection debugging
    try {
      console.log('[MANUFACTURING_DB] Testing database connection...');
      await manufacturingDb.raw('SELECT 1 as connection_test');
      console.log('[MANUFACTURING_DB] Database connection is working');
    } catch (connError) {
      console.error('[MANUFACTURING_DB] Database connection test failed:', connError);
    }
    
    return false;
  }
}

// Function to get product name by serial number
export async function getProductNameBySerialNumber(serialNumber: string): Promise<string | null> {
  console.log(`[MANUFACTURING_DB] Getting product name for serial number: "${serialNumber}"`);
  
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
    
    console.log(`[MANUFACTURING_DB] Raw SQL query: ${sql.replace('?', `'${serialNumber}'`)}`);
    
    const result = await manufacturingDb.raw(sql, [serialNumber]);
    
    // Debug what was returned
    console.log(`[MANUFACTURING_DB] Query result:`, result);
    
    // For Postgres, the result format is different from other SQL engines
    if (result && result.rows && result.rows.length > 0) {
      const productName = result.rows[0].product_name;
      console.log(`[MANUFACTURING_DB] Found product name: ${productName}`);
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
    
    console.log(`[MANUFACTURING_DB] Fallback SQL query: ${fallbackSql.replace('?', `'%${serialNumber}%'`)}`);
    
    const fallbackResult = await manufacturingDb.raw(fallbackSql, [`%${serialNumber}%`]);
    
    // Debug what was returned
    console.log(`[MANUFACTURING_DB] Fallback query result:`, fallbackResult);
    
    if (fallbackResult && fallbackResult.rows && fallbackResult.rows.length > 0) {
      const productName = fallbackResult.rows[0].product_name;
      console.log(`[MANUFACTURING_DB] Found product name via fallback: ${productName}`);
      return productName;
    }
    
    // Final attempt: directly query the po_items table to get product_id
    console.log(`[MANUFACTURING_DB] Final attempt: Get product_id directly from po_items`);
    
    const itemQuery = `SELECT product_id FROM po_items WHERE serial_number = ? LIMIT 1`;
    console.log(`[MANUFACTURING_DB] Item SQL query: ${itemQuery.replace('?', `'${serialNumber}'`)}`);
    
    const itemResult = await manufacturingDb.raw(itemQuery, [serialNumber]);
    console.log(`[MANUFACTURING_DB] Item query result:`, itemResult);
    
    if (itemResult && itemResult.rows && itemResult.rows.length > 0 && itemResult.rows[0].product_id) {
      const productId = itemResult.rows[0].product_id;
      console.log(`[MANUFACTURING_DB] Found product_id: ${productId}`);
      
      // Get product name directly
      const productQuery = `SELECT name FROM products WHERE pid = ? LIMIT 1`;
      console.log(`[MANUFACTURING_DB] Product SQL query: ${productQuery.replace('?', productId)}`);
      
      const productResult = await manufacturingDb.raw(productQuery, [productId]);
      console.log(`[MANUFACTURING_DB] Product query result:`, productResult);
      
      if (productResult && productResult.rows && productResult.rows.length > 0) {
        return productResult.rows[0].name;
      }
    }
    
    console.log(`[MANUFACTURING_DB] Could not find product name for serial number: ${serialNumber}`);
    return null;
  } catch (error) {
    console.error('[MANUFACTURING_DB] Error getting product name:', error);
    if (error instanceof Error) {
      console.error(`[MANUFACTURING_DB] Error message: ${error.message}`);
      console.error(`[MANUFACTURING_DB] Error stack: ${error.stack}`);
    }
    return null;
  }
}