import knex from 'knex';

// Create manufacturing database connection
export const manufacturingDb = knex({
  client: 'pg',
  connection: {
    host: 'containers-us-west-126.railway.app',
    port: 6090,
    user: 'postgres',
    password: 'COMiOWyjRrZjVzMmWXvt',
    database: 'railway',
    ssl: { rejectUnauthorized: false }
  },
  pool: { min: 0, max: 7 }
});

// Function to check if a serial number exists in the manufacturing database
export async function checkSerialNumber(serialNumber: string): Promise<boolean> {
  console.log(`[MANUFACTURING_DB] Checking serial number: "${serialNumber}"`);
  
  try {
    // First, let's test the connection
    console.log('[MANUFACTURING_DB] Testing database connection...');
    const connectionTest = await manufacturingDb.raw('SELECT 1 as connection_test');
    console.log(`[MANUFACTURING_DB] Connection test result: ${JSON.stringify(connectionTest)}`);
    
    // Get list of tables to see what's available
    console.log('[MANUFACTURING_DB] Checking available tables...');
    const tablesResult = await manufacturingDb.raw(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log(`[MANUFACTURING_DB] Available tables: ${JSON.stringify(tablesResult.rows)}`);
    
    // Check if 'products' exists and query it
    console.log('[MANUFACTURING_DB] Checking products table...');
    try {
      const productsQuery = manufacturingDb('products')
        .select('*')
        .limit(1);
      console.log(`[MANUFACTURING_DB] Products query: ${productsQuery.toString()}`);
      const productsResult = await productsQuery;
      console.log(`[MANUFACTURING_DB] Products sample: ${JSON.stringify(productsResult)}`);
    } catch (err) {
      console.error('[MANUFACTURING_DB] Error querying products:', err);
    }
    
    // Log the SQL query that will be executed
    const query = manufacturingDb('products')
      .select('id', 'serial_number', 'name')
      .where('serial_number', serialNumber)
      .orWhere('id', serialNumber);
    
    console.log(`[MANUFACTURING_DB] Query: ${query.toString()}`);
    
    // Execute the query
    const result = await query.first();
    
    // Log the query result
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
    // Log the SQL query that will be executed
    const query = manufacturingDb('products')
      .select('name')
      .where('serial_number', serialNumber)
      .orWhere('id', serialNumber);
    
    console.log(`[MANUFACTURING_DB] Product query: ${query.toString()}`);
    
    // Execute the query
    const result = await query.first();
    
    // Log the query result
    console.log(`[MANUFACTURING_DB] Product query result: ${JSON.stringify(result)}`);
    
    return result ? result.name : null;
  } catch (error) {
    console.error('[MANUFACTURING_DB] Error getting product name:', error);
    if (error instanceof Error) {
      console.error(`[MANUFACTURING_DB] Error message: ${error.message}`);
      console.error(`[MANUFACTURING_DB] Error stack: ${error.stack}`);
    }
    return null;
  }
}