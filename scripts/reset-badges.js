import pg from 'pg';
const { Pool } = pg;

// Create a new pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function resetBadges() {
  try {
    const client = await pool.connect();
    
    try {
      // Start a transaction
      await client.query('BEGIN');
      
      // Delete all existing badges
      console.log('Deleting existing badges...');
      await client.query('DELETE FROM badges');
      
      // Create new badges with proper requirements
      console.log('Creating new badges...');
      await client.query(`
        INSERT INTO badges (name, icon, description, required_points, min_installations, active, created_at)
        VALUES 
          ('المبتدئ', 'emoji_events', 'أول خطوة في رحلتك مع بريق', 0, 0, 1, NOW()),
          ('مركب نشط', 'handyman', 'أتممت 5 عمليات تركيب بنجاح', 0, 5, 1, NOW()),
          ('محترف التركيب', 'build', 'أتممت 20 عملية تركيب بنجاح', 100, 20, 1, NOW()),
          ('خبير التركيب', 'psychology', 'أتممت 50 عملية تركيب بنجاح', 500, 50, 1, NOW()),
          ('نجم بريق', 'stars', 'حصلت على 1000 نقطة', 1000, 0, 1, NOW()),
          ('فني ذهبي', 'auto_awesome', 'أتممت 30 عملية تركيب وجمعت 750 نقطة', 750, 30, 1, NOW()),
          ('فني معتمد', 'verified', 'فني معتمد من بريق', 2000, 50, 1, NOW()),
          ('محترف الإضاءة', 'light', 'خبير في تركيب منتجات الإضاءة', 300, 15, 1, NOW()),
          ('فني الطاقة', 'electric_bolt', 'متخصص في منتجات كفاءة الطاقة', 500, 25, 1, NOW()),
          ('فني النخبة', 'workspace_premium', 'من أفضل فنيي بريق أداءً', 1500, 40, 1, NOW())
      `);
      
      // Commit the transaction
      await client.query('COMMIT');
      
      console.log('Successfully reset badges');
    } catch (error) {
      // If there's an error, rollback the transaction
      await client.query('ROLLBACK');
      console.error('Error resetting badges:', error);
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
resetBadges().catch(error => {
  console.error('Failed to reset badges:', error);
  process.exit(1);
});

// Export a dummy function for ESM compatibility
export default resetBadges;