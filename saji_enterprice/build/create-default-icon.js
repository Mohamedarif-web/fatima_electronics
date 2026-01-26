/**
 * Create a simple default icon for testing builds
 * Run: node build/create-default-icon.js
 */

const fs = require('fs');
const path = require('path');

// Create a simple SVG icon
const svgIcon = `
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4F46E5;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#7C3AED;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background circle -->
  <circle cx="256" cy="256" r="240" fill="url(#grad)" stroke="#1E1B4B" stroke-width="8"/>
  
  <!-- Letter "S" for Saji -->
  <text x="256" y="320" font-family="Arial, sans-serif" font-size="280" font-weight="bold" 
        fill="white" text-anchor="middle" stroke="#1E1B4B" stroke-width="4">S</text>
  
  <!-- Small "E" for Enterprises -->
  <text x="400" y="150" font-family="Arial, sans-serif" font-size="80" font-weight="bold" 
        fill="#FDE047" text-anchor="middle" stroke="#92400E" stroke-width="2">E</text>
</svg>
`;

// Save SVG file
const buildDir = path.dirname(__filename);
const svgPath = path.join(buildDir, 'default-icon.svg');
fs.writeFileSync(svgPath, svgIcon.trim());

console.log('✅ Created default icon: build/default-icon.svg');
console.log('');
console.log('🎨 To use this icon:');
console.log('1. Convert SVG to required formats using online converters');
console.log('2. Or replace with your own logo files');
console.log('');
console.log('📋 Required files:');
console.log('- build/icon.ico (Windows)');
console.log('- build/icon.icns (Mac)');
console.log('- build/icon.png (Linux)');
console.log('');
console.log('🔗 Online converters:');
console.log('- ICO: https://convertio.co/svg-ico/');
console.log('- ICNS: https://cloudconvert.com/svg-to-icns/');
console.log('- PNG: https://convertio.co/svg-png/');