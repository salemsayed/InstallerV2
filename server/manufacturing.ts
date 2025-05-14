import knex from 'knex';

// Create manufacturing database connection
export const manufacturingDb = knex({
  client: 'pg',
  connection: {
    host: '157.230.125.93',
    port: 5432,
    user: 'bareeq_user',
    password: 'bareeq@sigma20406080',
    database: 'manufacturing',
    ssl: { rejectUnauthorized: false }
  },
  pool: { 
    min: 0, 
    max: 7,
    // Add event handlers for connection issues
    afterCreate: (conn: any, done: Function) => {
      done(null, conn);
    }
  },
  // Disable query debugging
  debug: false,
  // Minimal logging for errors only
  log: {
    warn(message: string) {
      // Silent
    },
    error(message: string) {
      console.error('[MANUFACTURING_DB] Error:', message);
    },
    deprecate(message: string) {
      // Silent
    },
    debug(message: string) {
      // Silent
    },
  }
});

// Test connection silently on startup to verify connectivity
manufacturingDb.raw('SELECT 1')
  .catch(err => {
    console.error('[MANUFACTURING_DB] Connection test failed:', err);
  });

// Function to check if a serial number exists in the manufacturing database
export async function checkSerialNumber(serialNumber: string): Promise<boolean> {
  try {
    // Using the recommended EXISTS query approach for efficiency
    const sql = `
      SELECT EXISTS (
        SELECT 1
        FROM po_items
        WHERE serial_number = ?
      ) AS po_item_exists
    `;
    
    const result = await manufacturingDb.raw(sql, [serialNumber]);
    
    // For Postgres, the result format is different from other SQL engines
    // It returns an array with objects, we need to extract the boolean value from it
    if (result && result.rows && result.rows.length > 0) {
      const exists = result.rows[0].po_item_exists === true;
      if (exists) return true;
    }
    
    // Fallback to direct query if the EXISTS approach didn't work
    const fallbackQuery = manufacturingDb('po_items')
      .select('serial_number')
      .where('serial_number', serialNumber)
      .limit(1);
    
    const fallbackResult = await fallbackQuery;
    
    if (fallbackResult && fallbackResult.length > 0) {
      return true;
    }
    
    // Check for any entry with the printed_url containing our UUID (in case it's stored as part of URL)
    const urlQuery = manufacturingDb('po_items')
      .select('serial_number')
      .whereRaw('printed_url LIKE ?', [`%${serialNumber}%`])
      .limit(1);
    
    const urlResult = await urlQuery;
    
    return urlResult && urlResult.length > 0;
  } catch (error) {
    console.error('[MANUFACTURING_DB] Error checking serial number:', error);
    
    // Additional connection debugging in case of error
    try {
      await manufacturingDb.raw('SELECT 1 as connection_test');
    } catch (connError) {
      console.error('[MANUFACTURING_DB] Database connection test failed:', connError);
    }
    
    return false;
  }
}

// Function to get product name by serial number
export async function getProductNameBySerialNumber(serialNumber: string): Promise<string | null> {
  try {
    // Simplified approach with direct SQL query
    const sql = `
      SELECT p.name as product_name
      FROM po_items pi
      JOIN products p ON p.pid = pi.product_id
      WHERE pi.serial_number = ?
      LIMIT 1
    `;
    
    const result = await manufacturingDb.raw(sql, [serialNumber]);
    
    // For Postgres, the result format is different from other SQL engines
    if (result && result.rows && result.rows.length > 0) {
      return result.rows[0].product_name;
    }
    
    // Fallback: Try to get product by searching printed_url
    const fallbackSql = `
      SELECT p.name as product_name
      FROM po_items pi
      JOIN products p ON p.pid = pi.product_id
      WHERE pi.printed_url LIKE ?
      LIMIT 1
    `;
    
    const fallbackResult = await manufacturingDb.raw(fallbackSql, [`%${serialNumber}%`]);
    
    if (fallbackResult && fallbackResult.rows && fallbackResult.rows.length > 0) {
      return fallbackResult.rows[0].product_name;
    }
    
    // Final attempt: directly query the po_items table to get product_id
    const itemQuery = `SELECT product_id FROM po_items WHERE serial_number = ? LIMIT 1`;
    const itemResult = await manufacturingDb.raw(itemQuery, [serialNumber]);
    
    if (itemResult && itemResult.rows && itemResult.rows.length > 0 && itemResult.rows[0].product_id) {
      const productId = itemResult.rows[0].product_id;
      
      // Get product name directly
      const productQuery = `SELECT name FROM products WHERE pid = ? LIMIT 1`;
      const productResult = await manufacturingDb.raw(productQuery, [productId]);
      
      if (productResult && productResult.rows && productResult.rows.length > 0) {
        return productResult.rows[0].name;
      }
    }
    
    return null;
  } catch (error) {
    console.error('[MANUFACTURING_DB] Error getting product name:', error);
    return null;
  }
}