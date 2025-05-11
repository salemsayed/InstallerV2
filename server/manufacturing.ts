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
  pool: { min: 0, max: 7 }
});

// Function to check if a serial number exists in the manufacturing database
export async function checkSerialNumber(serialNumber: string): Promise<boolean> {
  console.log(`[MANUFACTURING_DB] Checking serial number: "${serialNumber}"`);
  
  try {
    // Log the SQL query that will be executed
    const query = manufacturingDb('po_items')
      .select('serial_number')
      .where('serial_number', serialNumber);
    
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
    const query = manufacturingDb('po_items as pi')
      .join('products as p', 'p.pid', 'pi.product_id')
      .select('p.name as product_name', 'pi.serial_number', 'pi.product_id')
      .where('pi.serial_number', serialNumber);
    
    console.log(`[MANUFACTURING_DB] Product query: ${query.toString()}`);
    
    // Execute the query
    const result = await query.first();
    
    // Log the query result
    console.log(`[MANUFACTURING_DB] Product query result: ${JSON.stringify(result)}`);
    
    // If no result, try to get more info about the product ID
    if (!result) {
      console.log('[MANUFACTURING_DB] No product found, checking if item exists without joining products');
      
      const itemQuery = manufacturingDb('po_items')
        .select('*')
        .where('serial_number', serialNumber);
      
      console.log(`[MANUFACTURING_DB] Item query: ${itemQuery.toString()}`);
      
      const itemResult = await itemQuery.first();
      console.log(`[MANUFACTURING_DB] Item query result: ${JSON.stringify(itemResult)}`);
      
      if (itemResult) {
        console.log(`[MANUFACTURING_DB] Item exists but product join failed. Product ID: ${itemResult.product_id}`);
        
        // Try to directly query the product
        const productQuery = manufacturingDb('products')
          .select('*')
          .where('pid', itemResult.product_id);
        
        console.log(`[MANUFACTURING_DB] Direct product query: ${productQuery.toString()}`);
        
        const productResult = await productQuery.first();
        console.log(`[MANUFACTURING_DB] Direct product query result: ${JSON.stringify(productResult)}`);
      }
    }
    
    return result ? result.product_name : null;
  } catch (error) {
    console.error('[MANUFACTURING_DB] Error getting product name:', error);
    if (error instanceof Error) {
      console.error(`[MANUFACTURING_DB] Error message: ${error.message}`);
      console.error(`[MANUFACTURING_DB] Error stack: ${error.stack}`);
    }
    return null;
  }
}