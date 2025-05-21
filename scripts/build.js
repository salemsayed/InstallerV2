// Build script that runs before deployment
// This script will:
// 1. Increment the version for deployment
// 2. Run any other necessary pre-deployment tasks

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name correctly in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// First, run the version increment script
console.log("🔄 Incrementing version number for deployment...");

// Run the increment-version-deploy.js script
const incrementVersionProcess = spawn('node', [path.join(__dirname, 'increment-version-deploy.js')], {
  stdio: 'inherit'
});

incrementVersionProcess.on('close', (code) => {
  if (code !== 0) {
    console.error("❌ Version increment failed");
    process.exit(code);
  }
  
  console.log("✅ Version successfully incremented");
  
  // Here you can run additional build tasks if needed
  // For example, optimizing assets, running production build, etc.
  
  console.log("🚀 Build process completed successfully!");
});