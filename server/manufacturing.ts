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
  try {
    const result = await manufacturingDb('po_items')
      .select('serial_number')
      .where('serial_number', serialNumber)
      .first();
    
    return !!result;
  } catch (error) {
    console.error('Error checking serial number:', error);
    return false;
  }
}

// Function to get product name by serial number
export async function getProductNameBySerialNumber(serialNumber: string): Promise<string | null> {
  try {
    const result = await manufacturingDb('po_items as pi')
      .join('products as p', 'p.pid', 'pi.product_id')
      .select('p.name as product_name')
      .where('pi.serial_number', serialNumber)
      .first();
    
    return result ? result.product_name : null;
  } catch (error) {
    console.error('Error getting product name:', error);
    return null;
  }
}