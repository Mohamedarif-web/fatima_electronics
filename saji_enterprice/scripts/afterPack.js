const fs = require('fs');
const path = require('path');

exports.default = async function(context) {
    const appOutDir = context.appOutDir;
    console.log('🔧 Running afterPack script...');
    
    try {
        // Ensure bcryptjs is available in the app
        const resourcesPath = path.join(appOutDir, 'resources', 'app', 'node_modules', 'bcryptjs');
        
        if (fs.existsSync(resourcesPath)) {
            console.log('✅ bcryptjs found in bundled app');
        } else {
            console.log('⚠️ bcryptjs not found, this may cause runtime errors');
        }
        
        // Log the structure for debugging
        const appPath = path.join(appOutDir, 'resources', 'app');
        if (fs.existsSync(appPath)) {
            const nodeModulesPath = path.join(appPath, 'node_modules');
            if (fs.existsSync(nodeModulesPath)) {
                const modules = fs.readdirSync(nodeModulesPath);
                console.log('📦 Available modules:', modules.filter(m => m.includes('bcrypt') || m.includes('sqlite')));
            }
        }
        
    } catch (error) {
        console.error('❌ afterPack script error:', error);
    }
};