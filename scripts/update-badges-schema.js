import pg from 'pg';
const { Pool } = pg;

// Create a new pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function updateBadgesSchema() {
  try {
    const client = await pool.connect();
    
    try {
      // Start a transaction
      await client.query('BEGIN');
      
      // Check if the columns already exist
      const columnsResult = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'badges' 
        AND column_name IN ('required_points', 'min_level', 'min_installations', 'created_at')
      `);
      
      // Get existing column names
      const existingColumns = columnsResult.rows.map(row => row.column_name);
      
      // Add required_points column if it doesn't exist
      if (!existingColumns.includes('required_points')) {
        console.log('Adding required_points column to badges table');
        await client.query(`ALTER TABLE badges ADD COLUMN required_points INTEGER`);
      }
      
      // Add min_level column if it doesn't exist
      if (!existingColumns.includes('min_level')) {
        console.log('Adding min_level column to badges table');
        await client.query(`ALTER TABLE badges ADD COLUMN min_level INTEGER`);
      }
      
      // Add min_installations column if it doesn't exist
      if (!existingColumns.includes('min_installations')) {
        console.log('Adding min_installations column to badges table');
        await client.query(`ALTER TABLE badges ADD COLUMN min_installations INTEGER`);
      }
      
      // Add created_at column if it doesn't exist
      if (!existingColumns.includes('created_at')) {
        console.log('Adding created_at column to badges table');
        await client.query(`ALTER TABLE badges ADD COLUMN created_at TIMESTAMP DEFAULT NOW()`);
      }
      
      // Commit the transaction
      await client.query('COMMIT');
      
      console.log('Successfully updated badges schema');
    } catch (error) {
      // If there's an error, rollback the transaction
      await client.query('ROLLBACK');
      console.error('Error updating badges schema:', error);
      throw error;
    } finally {
      // Release the client back to the pool
      client.release();
    }
  } catch (error) {
    console.error('Error connecting to the database:', error);
    throw error;
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Run the function
updateBadgesSchema().catch(error => {
  console.error('Failed to update badges schema:', error);
  process.exit(1);
});

// Export a dummy function for ESM compatibility
export default updateBadgesSchema;