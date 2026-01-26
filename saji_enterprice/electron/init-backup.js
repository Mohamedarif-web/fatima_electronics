/**
 * Initialize Backup System
 * Call this from your main.js file to start automatic backups
 * 
 * Usage in main.js:
 * const initBackup = require('./init-backup');
 * initBackup.start();
 */

const simpleBackup = require('./simple-backup');

class BackupInitializer {
    constructor() {
        this.isStarted = false;
    }

    // Start backup system
    start() {
        if (this.isStarted) {
            console.log('⚠️ Backup system already started');
            return;
        }

        try {
            const success = simpleBackup.init();
            if (success) {
                this.isStarted = true;
                console.log('🚀 Backup system started successfully');
                
                // Setup cleanup on app close
                this.setupCleanup();
                
                return true;
            } else {
                console.error('❌ Failed to start backup system');
                return false;
            }
        } catch (error) {
            console.error('❌ Backup initialization error:', error);
            return false;
        }
    }

    // Setup cleanup when app closes
    setupCleanup() {
        // Handle app quit events
        process.on('before-quit', () => {
            console.log('📤 App closing - creating final backup...');
            simpleBackup.finalBackup();
            simpleBackup.stopAutoBackup();
        });

        // Handle app termination
        process.on('SIGTERM', () => {
            simpleBackup.finalBackup();
            simpleBackup.stopAutoBackup();
        });

        process.on('SIGINT', () => {
            simpleBackup.finalBackup();
            simpleBackup.stopAutoBackup();
        });
    }

    // Get status
    getStatus() {
        if (!this.isStarted) {
            return { started: false, message: 'Backup system not started' };
        }

        return {
            started: true,
            ...simpleBackup.getBackupInfo()
        };
    }

    // Manual backup trigger
    createBackup() {
        if (!this.isStarted) {
            console.log('⚠️ Backup system not started');
            return false;
        }
        
        return simpleBackup.createBackup();
    }
}

// Export singleton
module.exports = new BackupInitializer();