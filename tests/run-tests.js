#!/usr/bin/env node

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get all test files
const testDir = __dirname;
const testFiles = fs.readdirSync(testDir)
  .filter(file => file.endsWith('.test.js'))
  .map(file => path.join(testDir, file));

console.log('=== برنامج مكافات بريق - Test Runner ===');
console.log(`Found ${testFiles.length} test files:`);
testFiles.forEach(file => console.log(`- ${path.basename(file)}`));
console.log('\nRunning tests...\n');

try {
  // Run mocha with all test files
  execSync(`npx mocha ${testFiles.join(' ')} --timeout 10000`, { stdio: 'inherit' });
  console.log('\n✅ All tests completed successfully!');
} catch (error) {
  console.error('\n❌ Tests failed!');
  process.exit(1);
}