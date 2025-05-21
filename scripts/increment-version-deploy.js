import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name correctly in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the version file
const versionFilePath = path.join(__dirname, '..', 'shared', 'version.ts');

/**
 * Increments version number for deployment (always minor by default)
 * @param {string} currentVersion - Current version string (e.g., 'v1.1.1')
 * @returns {string} - New version string
 */
function incrementVersionForDeploy(currentVersion) {
  // Strip the 'v' prefix if present
  const versionString = currentVersion.startsWith('v') 
    ? currentVersion.substring(1) 
    : currentVersion;
  
  // Split version into components
  const [major, minor, patch] = versionString.split('.').map(Number);
  
  // For deployments, we increment the minor version by default
  return `v${major}.${minor + 1}.0`;
}

/**
 * Updates the version file with a deployment-specific version bump
 */
function updateVersionForDeploy() {
  try {
    // Read the current file
    const fileContent = fs.readFileSync(versionFilePath, 'utf8');
    
    // Extract current version
    const versionRegex = /export const APP_VERSION = ['"](.+)['"];/;
    const match = fileContent.match(versionRegex);
    
    if (!match) {
      console.error('Could not find version string in file');
      process.exit(1);
    }
    
    const currentVersion = match[1];
    console.log(`Current version: ${currentVersion}`);
    
    const newVersion = incrementVersionForDeploy(currentVersion);
    console.log(`New deployment version: ${newVersion}`);
    
    // Add new version entry to version history
    const timestamp = new Date().toISOString().split('T')[0];
    
    // Update file content
    const updatedContent = fileContent
      // Update version number
      .replace(versionRegex, `export const APP_VERSION = '${newVersion}';`)
      // Add deployment-specific entry to history
      .replace(/(\/\/ v[\d.]+.+\n)(\n*export const APP_VERSION)/, `$1// ${newVersion} - Deployment on ${timestamp}\n$2`);
    
    // Write the updated content back to the file
    fs.writeFileSync(versionFilePath, updatedContent);
    console.log('Version automatically incremented for deployment!');
    
  } catch (error) {
    console.error('Error updating version file for deployment:', error);
    process.exit(1);
  }
}

// Execute the update
updateVersionForDeploy();