const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class BackupManager {
    constructor() {
        this.mainDbPath = null;
        this.backupPaths = {
            local: null,      // Same folder as main DB
            secondary: null,  // Documents folder
            external: null    // External backup location
        };
        this.backupInterval = null;
        this.isBackupRunning = false;
    }

    initialize() {
        try {
            // Get paths
            const userDataPath = app.getPath('userData');
            const documentsPath = app.getPath('documents');
            
            this.mainDbPath = path.join(userDataPath, 'saji_enterprises.db');
            
            // Setup backup paths
            this.backupPaths.local = path.join(userDataPath, 'backups');
            this.backupPaths.secondary = path.join(documentsPath, 'SajiEnterprises_Backups');
            this.backupPaths.external = path.join(userDataPath, 'external_backup');
            
            // Create backup directories
            this.createBackupDirectories();
            
            // Start automatic backup
            this.startAutomaticBackup();
            
            console.log('✅ Backup Manager initialized');
            console.log('📁 Main DB:', this.mainDbPath);
            console.log('💾 Local Backup:', this.backupPaths.local);
            console.log('📂 Secondary Backup:', this.backupPaths.secondary);
            
            return true;
        } catch (error) {
            console.error('❌ Backup Manager initialization failed:', error);
            return false;
        }
    }

    createBackupDirectories() {
        Object.values(this.backupPaths).forEach(backupPath => {
            try {
                if (!fs.existsSync(backupPath)) {
                    fs.mkdirSync(backupPath, { recursive: true });
                    console.log(`✅ Created backup directory: ${backupPath}`);
                }
            } catch (error) {
                console.error(`❌ Failed to create backup directory ${backupPath}:`, error);
            }
        });
    }

    async createBackup(type = 'auto') {
        if (this.isBackupRunning) {
            console.log('⏳ Backup already in progress, skipping...');
            return false;
        }

        this.isBackupRunning = true;
        
        try {
            // Check if main DB exists
            if (!fs.existsSync(this.mainDbPath)) {
                console.log('ℹ️ Main database not found, skipping backup');
                return false;
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFileName = `saji_enterprises_${type}_${timestamp}.db`;
            
            console.log(`💾 Creating ${type} backup: ${backupFileName}`);
            
            // Create backups in multiple locations
            const backupPromises = [];
            
            // 1. Local backup (same app folder)
            const localBackupPath = path.join(this.backupPaths.local, backupFileName);
            backupPromises.push(this.copyDatabaseFile(this.mainDbPath, localBackupPath, 'Local'));
            
            // 2. Secondary backup (Documents folder)
            const secondaryBackupPath = path.join(this.backupPaths.secondary, backupFileName);
            backupPromises.push(this.copyDatabaseFile(this.mainDbPath, secondaryBackupPath, 'Secondary'));
            
            // 3. Keep only latest 10 backups in each location
            this.cleanupOldBackups();
            
            // Wait for all backups to complete
            const results = await Promise.allSettled(backupPromises);
            
            let successCount = 0;
            results.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value) {
                    successCount++;
                }
            });
            
            console.log(`✅ Backup completed: ${successCount}/${results.length} locations successful`);
            
            // Create backup log
            this.logBackupEvent(type, backupFileName, successCount, results.length);
            
            return successCount > 0;
            
        } catch (error) {
            console.error('❌ Backup failed:', error);
            return false;
        } finally {
            this.isBackupRunning = false;
        }
    }

    async copyDatabaseFile(sourcePath, destPath, location) {
        try {
            // Verify source file integrity first
            const sourceStats = fs.statSync(sourcePath);
            if (sourceStats.size === 0) {
                throw new Error('Source database file is empty');
            }
            
            // Create directory if it doesn't exist
            const destDir = path.dirname(destPath);
            if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
            }
            
            // Copy file
            fs.copyFileSync(sourcePath, destPath);
            
            // Verify backup file integrity
            const destStats = fs.statSync(destPath);
            if (destStats.size !== sourceStats.size) {
                throw new Error('Backup file size mismatch');
            }
            
            console.log(`✅ ${location} backup created: ${destPath}`);
            return true;
            
        } catch (error) {
            console.error(`❌ ${location} backup failed:`, error);
            return false;
        }
    }

    cleanupOldBackups() {
        Object.entries(this.backupPaths).forEach(([type, backupPath]) => {
            try {
                if (!fs.existsSync(backupPath)) return;
                
                const files = fs.readdirSync(backupPath)
                    .filter(file => file.startsWith('saji_enterprises_') && file.endsWith('.db'))
                    .map(file => ({
                        name: file,
                        path: path.join(backupPath, file),
                        mtime: fs.statSync(path.join(backupPath, file)).mtime
                    }))
                    .sort((a, b) => b.mtime - a.mtime);
                
                // Keep only the 10 most recent backups
                if (files.length > 10) {
                    const filesToDelete = files.slice(10);
                    filesToDelete.forEach(file => {
                        try {
                            fs.unlinkSync(file.path);
                            console.log(`🗑️ Deleted old backup: ${file.name}`);
                        } catch (error) {
                            console.error(`❌ Failed to delete old backup: ${file.name}`, error);
                        }
                    });
                }
                
            } catch (error) {
                console.error(`❌ Cleanup failed for ${type} backups:`, error);
            }
        });
    }

    logBackupEvent(type, fileName, successCount, totalCount) {
        try {
            const logPath = path.join(this.backupPaths.local, 'backup_log.txt');
            const logEntry = `${new Date().toISOString()} - ${type} backup: ${fileName} (${successCount}/${totalCount} successful)\n`;
            
            fs.appendFileSync(logPath, logEntry);
        } catch (error) {
            console.error('❌ Failed to write backup log:', error);
        }
    }

    startAutomaticBackup() {
        // Create backup every 30 minutes
        this.backupInterval = setInterval(() => {
            this.createBackup('auto');
        }, 30 * 60 * 1000); // 30 minutes
        
        // Also create backup on app startup
        setTimeout(() => {
            this.createBackup('startup');
        }, 10000); // 10 seconds after startup
        
        console.log('⏰ Automatic backup scheduled every 30 minutes');
    }

    stopAutomaticBackup() {
        if (this.backupInterval) {
            clearInterval(this.backupInterval);
            this.backupInterval = null;
            console.log('⏹️ Automatic backup stopped');
        }
    }

    // Manual backup triggered by user
    async manualBackup() {
        console.log('👤 Manual backup requested by user');
        return await this.createBackup('manual');
    }

    // Emergency backup before critical operations
    async emergencyBackup() {
        console.log('🚨 Emergency backup before critical operation');
        return await this.createBackup('emergency');
    }

    // Get backup status
    getBackupStatus() {
        try {
            const status = {
                mainDbExists: fs.existsSync(this.mainDbPath),
                mainDbSize: 0,
                backups: {},
                lastBackup: null
            };
            
            if (status.mainDbExists) {
                status.mainDbSize = fs.statSync(this.mainDbPath).size;
            }
            
            // Check each backup location
            Object.entries(this.backupPaths).forEach(([type, backupPath]) => {
                status.backups[type] = {
                    exists: fs.existsSync(backupPath),
                    count: 0,
                    latestBackup: null
                };
                
                if (status.backups[type].exists) {
                    const files = fs.readdirSync(backupPath)
                        .filter(file => file.startsWith('saji_enterprises_') && file.endsWith('.db'));
                    
                    status.backups[type].count = files.length;
                    
                    if (files.length > 0) {
                        const latestFile = files
                            .map(file => ({
                                name: file,
                                mtime: fs.statSync(path.join(backupPath, file)).mtime
                            }))
                            .sort((a, b) => b.mtime - a.mtime)[0];
                        
                        status.backups[type].latestBackup = latestFile;
                        
                        if (!status.lastBackup || latestFile.mtime > status.lastBackup.mtime) {
                            status.lastBackup = latestFile;
                        }
                    }
                }
            });
            
            return status;
        } catch (error) {
            console.error('❌ Failed to get backup status:', error);
            return null;
        }
    }

    // Restore from backup
    async restoreFromBackup(backupFilePath) {
        try {
            console.log(`🔄 Restoring database from: ${backupFilePath}`);
            
            // Verify backup file exists and is valid
            if (!fs.existsSync(backupFilePath)) {
                throw new Error('Backup file not found');
            }
            
            const backupStats = fs.statSync(backupFilePath);
            if (backupStats.size === 0) {
                throw new Error('Backup file is empty');
            }
            
            // Create emergency backup of current DB before restore
            if (fs.existsSync(this.mainDbPath)) {
                await this.emergencyBackup();
            }
            
            // Copy backup to main DB location
            fs.copyFileSync(backupFilePath, this.mainDbPath);
            
            console.log('✅ Database restored successfully');
            return true;
            
        } catch (error) {
            console.error('❌ Database restore failed:', error);
            return false;
        }
    }
}

// Create singleton instance
const backupManager = new BackupManager();

module.exports = backupManager;