// Deployment build script that:
// 1. Increments the version for deployment
// 2. Runs the regular build process
// This script is designed to be run during Replit deployment

import { spawn, exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name correctly in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("📦 Starting deployment build process...");

// Step 1: Run the version increment script
console.log("🔄 Incrementing version number for deployment...");

const incrementVersionProcess = spawn('node', [path.join(__dirname, 'increment-version-deploy.js')], {
  stdio: 'inherit'
});

incrementVersionProcess.on('close', (code) => {
  if (code !== 0) {
    console.error("❌ Version increment failed");
    process.exit(code);
  }
  
  console.log("✅ Version successfully incremented for deployment");
  
  // Step 2: Run the original build command
  console.log("🔨 Running the main build process...");
  
  // Execute the original build command (vite build + esbuild)
  exec('vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist', 
    (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ Build process error: ${error.message}`);
        process.exit(1);
      }
      
      if (stderr) {
        console.error(`Build warnings: ${stderr}`);
      }
      
      console.log(stdout);
      console.log("🚀 Deployment build completed successfully!");
      process.exit(0);
    }
  );
});