const fs = require('fs');
const path = require('path');
const { app } = require('electron');

/**
 * Simple Database Backup Solution
 * - Creates multiple backup copies in different locations
 * - Runs automatically in background
 * - No UI changes needed
 * - Perfect for production EXE distribution
 */

class SimpleBackup {
    constructor() {
        this.mainDbPath = null;
        this.backupLocations = [];
        this.backupTimer = null;
    }

    init() {
        try {
            // Get main database path
            const userDataPath = app.getPath('userData');
            this.mainDbPath = path.join(userDataPath, 'saji_enterprises.db');
            
            // Setup backup locations
            const documentsPath = app.getPath('documents');
            
            this.backupLocations = [
                // Location 1: Same folder as main DB
                path.join(userDataPath, 'backup_primary'),
                
                // Location 2: Documents folder  
                path.join(documentsPath, 'SajiEnterprises_Backup'),
                
                // Location 3: Desktop backup (if accessible)
                path.join(app.getPath('desktop'), 'SajiBackup')
            ];
            
            // Create backup directories
            this.createBackupDirs();
            
            // Start automatic backup (every 10 minutes)
            this.startAutoBackup();
            
            console.log('✅ Simple Backup System Started');
            return true;
        } catch (error) {
            console.error('❌ Backup init failed:', error);
            return false;
        }
    }

    createBackupDirs() {
        this.backupLocations.forEach((location, index) => {
            try {
                if (!fs.existsSync(location)) {
                    fs.mkdirSync(location, { recursive: true });
                    console.log(`✅ Backup location ${index + 1} created: ${location}`);
                }
            } catch (error) {
                console.error(`❌ Failed to create backup location ${index + 1}:`, error);
            }
        });
    }

    createBackup() {
        try {
            // Check if main DB exists
            if (!fs.existsSync(this.mainDbPath)) {
                console.log('ℹ️ Main database not found yet');
                return false;
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
            const backupFileName = `saji_db_${timestamp}.db`;
            
            let successCount = 0;
            
            // Copy to all backup locations
            this.backupLocations.forEach((location, index) => {
                try {
                    const backupPath = path.join(location, backupFileName);
                    
                    // Copy main database
                    fs.copyFileSync(this.mainDbPath, backupPath);
                    
                    // Verify backup
                    const originalSize = fs.statSync(this.mainDbPath).size;
                    const backupSize = fs.statSync(backupPath).size;
                    
                    if (originalSize === backupSize) {
                        successCount++;
                        console.log(`✅ Backup ${index + 1} created successfully`);
                    } else {
                        console.error(`❌ Backup ${index + 1} size mismatch`);
                    }
                    
                } catch (error) {
                    console.error(`❌ Backup ${index + 1} failed:`, error.message);
                }
            });
            
            // Keep only latest 5 backups in each location
            this.cleanupOldBackups();
            
            console.log(`💾 Backup completed: ${successCount}/${this.backupLocations.length} successful`);
            return successCount > 0;
            
        } catch (error) {
            console.error('❌ Backup process failed:', error);
            return false;
        }
    }

    cleanupOldBackups() {
        this.backupLocations.forEach((location, index) => {
            try {
                if (!fs.existsSync(location)) return;
                
                const files = fs.readdirSync(location)
                    .filter(file => file.startsWith('saji_db_') && file.endsWith('.db'))
                    .map(file => ({
                        name: file,
                        path: path.join(location, file),
                        time: fs.statSync(path.join(location, file)).mtime
                    }))
                    .sort((a, b) => b.time - a.time);
                
                // Keep only 5 most recent backups
                if (files.length > 5) {
                    const oldFiles = files.slice(5);
                    oldFiles.forEach(file => {
                        try {
                            fs.unlinkSync(file.path);
                            console.log(`🗑️ Deleted old backup: ${file.name}`);
                        } catch (error) {
                            console.error(`❌ Failed to delete: ${file.name}`);
                        }
                    });
                }
            } catch (error) {
                console.error(`❌ Cleanup failed for location ${index + 1}:`, error);
            }
        });
    }

    startAutoBackup() {
        // Create backup every 10 minutes
        this.backupTimer = setInterval(() => {
            this.createBackup();
        }, 10 * 60 * 1000);
        
        // Create initial backup after 30 seconds
        setTimeout(() => {
            this.createBackup();
        }, 30000);
        
        console.log('⏰ Auto backup every 10 minutes');
    }

    stopAutoBackup() {
        if (this.backupTimer) {
            clearInterval(this.backupTimer);
            this.backupTimer = null;
            console.log('⏹️ Auto backup stopped');
        }
    }

    // Create final backup on app close
    finalBackup() {
        console.log('🔚 Creating final backup before close...');
        return this.createBackup();
    }

    // Get backup info
    getBackupInfo() {
        const info = {
            mainDbExists: fs.existsSync(this.mainDbPath),
            mainDbPath: this.mainDbPath,
            backupLocations: [],
            totalBackups: 0
        };

        this.backupLocations.forEach((location, index) => {
            const locationInfo = {
                path: location,
                exists: fs.existsSync(location),
                backupCount: 0,
                latestBackup: null
            };

            if (locationInfo.exists) {
                const files = fs.readdirSync(location)
                    .filter(file => file.startsWith('saji_db_') && file.endsWith('.db'));
                
                locationInfo.backupCount = files.length;
                info.totalBackups += files.length;

                if (files.length > 0) {
                    const latest = files
                        .map(file => ({
                            name: file,
                            time: fs.statSync(path.join(location, file)).mtime
                        }))
                        .sort((a, b) => b.time - a.time)[0];
                    
                    locationInfo.latestBackup = latest;
                }
            }

            info.backupLocations.push(locationInfo);
        });

        return info;
    }
}

// Create instance
const simpleBackup = new SimpleBackup();

module.exports = simpleBackup;