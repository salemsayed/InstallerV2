// Import Products Script
// This script imports product names from a file and inserts them into the local_products table

import { db } from '../server/db.js';
import { localProducts } from '../shared/schema.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function importProducts() {
  console.log('Starting product import');
  
  try {
    // Read the product names file
    const productFile = path.join(__dirname, '../attached_assets/product_names.txt');
    const fileContents = fs.readFileSync(productFile, 'utf8');
    
    // Split by lines and filter out empty lines
    const productLines = fileContents.split('\n')
      .filter(line => line.length > 0);
    
    console.log(`Found ${productLines.length} products to import`);
    
    // Create array of products with fixed 15 points
    const productsToInsert = productLines.map(name => ({
      name: name, // Keep exactly as-is
      rewardPoints: 15, // Fixed reward points as requested
      isActive: 1
    }));
    
    // Insert products one by one and track results
    let successCount = 0;
    let errorCount = 0;
    let existingCount = 0;
    
    for (const product of productsToInsert) {
      try {
        // Try to insert the product
        const [insertedProduct] = await db
          .insert(localProducts)
          .values(product)
          .returning();
        
        successCount++;
        console.log(`Successfully imported: ${product.name}`);
      } catch (error) {
        // Check if it's a unique constraint violation
        if (error.message.includes('unique constraint') || error.code === '23505') {
          existingCount++;
          console.log(`Product already exists: ${product.name}`);
        } else {
          errorCount++;
          console.error(`Error importing product: ${product.name}`);
          console.error(error.message);
        }
      }
    }
    
    // Print summary
    console.log('==== Import Summary ====');
    console.log(`Total products: ${productLines.length}`);
    console.log(`Successfully imported: ${successCount}`);
    console.log(`Already existing: ${existingCount}`);
    console.log(`Errors: ${errorCount}`);
    
  } catch (error) {
    console.error('Fatal error during import:', error);
  }
}

// Run the import function
importProducts()
  .then(() => {
    console.log('Import process completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Unhandled error during import:', error);
    process.exit(1);
  });