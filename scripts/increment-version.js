// Version increment script
// Automatically increments the PATCH version in package.json
import fs from 'fs';
import path from 'path';

const packageJsonPath = path.resolve(process.cwd(), 'package.json');
let packageJsonContent;

try {
  packageJsonContent = fs.readFileSync(packageJsonPath, 'utf-8');
} catch (error) {
  console.error(`Error reading package.json at ${packageJsonPath}:`, error);
  process.exit(1);
}

let packageJson;
try {
  packageJson = JSON.parse(packageJsonContent);
} catch (error) {
  console.error(`Error parsing package.json content:`, error);
  process.exit(1);
}

if (!packageJson.version || typeof packageJson.version !== 'string') {
  console.error('No valid version field found in package.json. Initializing to v0.1.0');
  packageJson.version = '0.1.0'; // Initialize if not present or invalid
}

const versionString = packageJson.version;
const versionParts = versionString.replace(/^v/, '').split('.');
if (versionParts.length !== 3) {
  console.error(`Invalid version format in package.json: "${packageJson.version}". Expected MAJOR.MINOR.PATCH. Resetting PATCH to 0.`);
  versionParts[0] = versionParts[0] || '0';
  versionParts[1] = versionParts[1] || '1';
  versionParts[2] = '0'; // Reset patch if format is wrong
}

let major = parseInt(versionParts[0], 10);
let minor = parseInt(versionParts[1], 10);
let patch = parseInt(versionParts[2], 10);

if (isNaN(major)) major = 0;
if (isNaN(minor)) minor = 1;
if (isNaN(patch)) patch = -1; // Will be incremented to 0

patch++;
const newVersionString = `${major}.${minor}.${patch}`;
packageJson.version = newVersionString;

try {
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log(`✓ Application version incremented to v${newVersionString}`);
} catch (error) {
  console.error(`Error writing updated package.json:`, error);
  process.exit(1);
}