import knex from 'knex';

console.log('[MANUFACTURING_DB] Initializing connection to external manufacturing database');

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
    // First approach: direct match on serial_number
    console.log(`[MANUFACTURING_DB] Approach 1: Direct match on serial_number`);
    let query = manufacturingDb('po_items')
      .select('serial_number')
      .where('serial_number', serialNumber);
    
    console.log(`[MANUFACTURING_DB] Query: ${query.toString()}`);
    
    let result = await query.first();
    console.log(`[MANUFACTURING_DB] Query result: ${JSON.stringify(result)}`);
    
    if (result) return true;
    
    // Second approach: Check in printed_url field
    console.log(`[MANUFACTURING_DB] Approach 2: Check in printed_url field`);
    query = manufacturingDb('po_items')
      .select('serial_number', 'printed_url')
      .whereRaw(`printed_url LIKE '%${serialNumber}%'`);
    
    console.log(`[MANUFACTURING_DB] Query: ${query.toString()}`);
    
    result = await query.first();
    console.log(`[MANUFACTURING_DB] Query result: ${JSON.stringify(result)}`);
    
    if (result) return true;
    
    // Third approach: Check if it's in the URL format we're extracting from
    const urlToCheck = `https://warranty.bareeq.lighting/p/${serialNumber}`;
    console.log(`[MANUFACTURING_DB] Approach 3: Check for URL ${urlToCheck}`);
    
    query = manufacturingDb('po_items')
      .select('serial_number', 'printed_url')
      .whereRaw(`printed_url = ?`, [urlToCheck]);
    
    console.log(`[MANUFACTURING_DB] Query: ${query.toString()}`);
    
    result = await query.first();
    console.log(`[MANUFACTURING_DB] Query result: ${JSON.stringify(result)}`);
    
    if (result) return true;
    
    // Fourth approach: special case check - Look for values in the view tables
    console.log(`[MANUFACTURING_DB] Approach 4: Check in warranty view tables`);
    
    query = manufacturingDb('view_warranty_po_items')
      .select('*')
      .whereRaw(`serial_number = ? OR printed_url LIKE ?`, [serialNumber, `%${serialNumber}%`]);
    
    console.log(`[MANUFACTURING_DB] Query: ${query.toString()}`);
    
    result = await query.first();
    console.log(`[MANUFACTURING_DB] Query result: ${JSON.stringify(result)}`);
    
    return !!result;
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
    // Approach 1: Direct join with the original serial number
    console.log(`[MANUFACTURING_DB] Product Approach 1: Direct join with serial_number`);
    let query = manufacturingDb('po_items as pi')
      .join('products as p', 'p.pid', 'pi.product_id')
      .select('p.name as product_name', 'pi.serial_number', 'pi.product_id')
      .where('pi.serial_number', serialNumber);
    
    console.log(`[MANUFACTURING_DB] Product query: ${query.toString()}`);
    let result = await query.first();
    console.log(`[MANUFACTURING_DB] Product query result: ${JSON.stringify(result)}`);
    
    if (result) return result.product_name;
    
    // Approach 2: Check in the printed_url field
    console.log(`[MANUFACTURING_DB] Product Approach 2: Check in printed_url field`);
    query = manufacturingDb('po_items as pi')
      .join('products as p', 'p.pid', 'pi.product_id')
      .select('p.name as product_name', 'pi.serial_number', 'pi.product_id', 'pi.printed_url')
      .whereRaw(`pi.printed_url LIKE '%${serialNumber}%'`);
    
    console.log(`[MANUFACTURING_DB] Product query: ${query.toString()}`);
    result = await query.first();
    console.log(`[MANUFACTURING_DB] Product query result: ${JSON.stringify(result)}`);
    
    if (result) return result.product_name;
    
    // Approach 3: Check with full URL
    const urlToCheck = `https://warranty.bareeq.lighting/p/${serialNumber}`;
    console.log(`[MANUFACTURING_DB] Product Approach 3: Check with URL ${urlToCheck}`);
    
    query = manufacturingDb('po_items as pi')
      .join('products as p', 'p.pid', 'pi.product_id')
      .select('p.name as product_name', 'pi.serial_number', 'pi.product_id', 'pi.printed_url')
      .where('pi.printed_url', urlToCheck);
    
    console.log(`[MANUFACTURING_DB] Product query: ${query.toString()}`);
    result = await query.first();
    console.log(`[MANUFACTURING_DB] Product query result: ${JSON.stringify(result)}`);
    
    if (result) return result.product_name;
    
    // Approach 4: Try with warranty view tables
    console.log(`[MANUFACTURING_DB] Product Approach 4: Check with warranty view tables`);
    
    query = manufacturingDb('view_warranty_po_items as vpi')
      .join('products as p', 'p.pid', 'vpi.product_id')
      .select('p.name as product_name', 'vpi.serial_number')
      .whereRaw(`vpi.serial_number = ? OR vpi.printed_url LIKE ?`, [serialNumber, `%${serialNumber}%`]);
    
    console.log(`[MANUFACTURING_DB] Product query: ${query.toString()}`);
    result = await query.first();
    console.log(`[MANUFACTURING_DB] Product query result: ${JSON.stringify(result)}`);
    
    if (result) return result.product_name;
    
    // Last resort: Get any product as a fallback (only if product exists in database)
    // For now, let's just return a generic product name for debugging
    console.log(`[MANUFACTURING_DB] Product Approach 5: Check if item exists without product join`);
    const itemQuery = manufacturingDb('po_items')
      .select('*')
      .where('serial_number', serialNumber)
      .orWhereRaw(`printed_url LIKE ?`, [`%${serialNumber}%`]);
    
    console.log(`[MANUFACTURING_DB] Item query: ${itemQuery.toString()}`);
    const itemResult = await itemQuery.first();
    console.log(`[MANUFACTURING_DB] Item query result: ${JSON.stringify(itemResult)}`);
    
    if (itemResult && itemResult.product_id) {
      console.log(`[MANUFACTURING_DB] Item exists. Product ID: ${itemResult.product_id}`);
      
      // Get the product directly
      const productQuery = manufacturingDb('products')
        .select('*')
        .where('pid', itemResult.product_id);
      
      console.log(`[MANUFACTURING_DB] Direct product query: ${productQuery.toString()}`);
      const productResult = await productQuery.first();
      console.log(`[MANUFACTURING_DB] Direct product query result: ${JSON.stringify(productResult)}`);
      
      if (productResult) {
        return productResult.name;
      }
    }
    
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