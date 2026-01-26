// Simple script to create a basic icon for Windows build
const fs = require('fs');

// Create a simple SVG icon
const svgIcon = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#16a34a;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#15803d;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="256" height="256" rx="25" fill="url(#grad1)" stroke="#166534" stroke-width="4"/>
  <text x="128" y="140" font-family="Arial, sans-serif" font-size="80" font-weight="bold" 
        text-anchor="middle" fill="white" stroke="rgba(0,0,0,0.3)" stroke-width="2">FE</text>
  <text x="128" y="200" font-family="Arial, sans-serif" font-size="20" font-weight="bold" 
        text-anchor="middle" fill="#dcfce7">ELECTRONICS</text>
</svg>`;

// Write the SVG file
fs.writeFileSync('build/icon.svg', svgIcon);

console.log('✅ SVG icon created at build/icon.svg');
console.log('');
console.log('Next steps:');
console.log('1. Convert SVG to ICO format online:');
console.log('   - Go to: https://convertio.co/svg-ico/');
console.log('   - Upload build/icon.svg');
console.log('   - Download as icon.ico');
console.log('   - Place in build/icon.ico');
console.log('');
console.log('2. Or use the batch file to build:');
console.log('   - Double-click build-windows.bat');
console.log('   - Or run: npm run build:win');