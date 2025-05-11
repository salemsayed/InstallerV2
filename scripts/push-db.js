#!/usr/bin/env node
const { execSync } = require('child_process');

// Execute DB push
console.log('🔄 Pushing schema to database...');
try {
  execSync('npx drizzle-kit push:pg', { stdio: 'inherit' });
  console.log('✅ Schema pushed successfully!');
} catch (error) {
  console.error('❌ Error pushing schema:', error.message);
  process.exit(1);
}