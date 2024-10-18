// File: scripts/generateVersion.js
const fs = require('fs');
const path = require('path');

const packageJson = require('../package.json');
const versionFileContent = `
/**
 * The current version of the API
 * @type {string}
 */
module.exports = '${packageJson.version}';
`;

const versionFilePath = path.join(__dirname, '../src/version.js');

fs.writeFileSync(versionFilePath, versionFileContent);

console.log(`Version file updated: ${versionFilePath}`);
