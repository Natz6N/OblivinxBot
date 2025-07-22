import path from "path";
import { promises as fs } from 'fs';
import EventEmitter from "events";
/**
 * JSONManager - Library untuk mengelola file JSON dengan backup otomatis
 * 
 * Fitur:
 * - CRUD operations untuk data JSON
 * - Auto backup setiap 24 jam
 * - Manual backup
 * - Restore dari backup
 * - Event logging
 * - Error handling yang robust
 * 
 * @class JSONManager
 * @extends EventEmitter
 */
class JSONManager extends EventEmitter {
    /**
     * @param {Object} options - Konfigurasi JSONManager
     * @param {string} options.filePath - Path ke file JSON utama
     * @param {string} [options.backupDir='./backups'] - Directory untuk menyimpan backup
     * @param {number} [options.backupInterval=24] - Interval backup dalam jam
     * @param {number} [options.maxBackups=7] - Maksimal jumlah backup yang disimpan
     * @param {boolean} [options.autoBackup=true] - Aktifkan auto backup
     */
    constructor(options = {}) {
        super();
        
        // Validasi parameter wajib
        if (!options.filePath) {
            throw new Error('filePath is required');
        }
        
        this.filePath = path.resolve(options.filePath);
        this.backupDir = path.resolve(options.backupDir || './backups');
        this.backupInterval = (options.backupInterval || 24) * 60 * 60 * 1000; // Convert to milliseconds
        this.maxBackups = options.maxBackups || 7;
        this.autoBackup = options.autoBackup !== false;
        
        this.data = {};
        this.backupTimer = null;
        this.isInitialized = false;
        
        // Event listeners
        this.on('error', (error) => {
            console.error(`[JSONManager Error]: ${error.message}`);
        });
        
        this.on('backup', (backupPath) => {
            console.log(`[JSONManager]: Backup created at ${backupPath}`);
        });
        
        this.on('dataChanged', () => {
            console.log(`[JSONManager]: Data updated`);
        });
    }
    
    /**
     * Inisialisasi JSONManager
     * Membuat directory backup, load data existing, dan start auto backup
     */
    async init() {
        try {
            // Buat backup directory jika belum ada
            await this.ensureBackupDir();
            
            // Load data existing atau buat file baru
            await this.loadData();
            
            // Start auto backup jika diaktifkan
            if (this.autoBackup) {
                this.startAutoBackup();
            }
            
            this.isInitialized = true;
            this.emit('initialized');
            console.log(`[JSONManager]: Initialized successfully`);
            
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }
    
    /**
     * Memuat data dari file JSON
     */
    async loadData() {
        try {
            const fileExists = await this.fileExists(this.filePath);
            
            if (fileExists) {
                const rawData = await fs.readFile(this.filePath, 'utf8');
                this.data = JSON.parse(rawData);
            } else {
                // Buat file baru dengan data kosong
                this.data = {};
                await this.saveData();
            }
        } catch (error) {
            // Jika file corrupt, coba restore dari backup terbaru
            console.warn(`[JSONManager]: Main file corrupt, attempting restore from backup`);
            const restored = await this.restoreFromLatestBackup();
            
            if (!restored) {
                // Jika tidak ada backup, mulai dengan data kosong
                this.data = {};
                await this.saveData();
            }
        }
    }
    
    /**
     * Menyimpan data ke file JSON
     */
    async saveData() {
        try {
            const dataString = JSON.stringify(this.data, null, 2);
            await fs.writeFile(this.filePath, dataString, 'utf8');
            this.emit('dataSaved');
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }
    
    /**
     * Mendapatkan semua data
     * @returns {Object} Data JSON
     */
    getData() {
        this.checkInitialized();
        return { ...this.data };
    }
    
    /**
     * Mendapatkan value berdasarkan key
     * @param {string} key - Key yang dicari
     * @param {*} defaultValue - Default value jika key tidak ditemukan
     * @returns {*} Value dari key
     */
    get(key, defaultValue = null) {
        this.checkInitialized();
        return this.getNestedValue(this.data, key, defaultValue);
    }
    
    /**
     * Set value untuk key tertentu
     * @param {string} key - Key yang akan di-set
     * @param {*} value - Value yang akan disimpan
     */
    async set(key, value) {
        this.checkInitialized();
        
        this.setNestedValue(this.data, key, value);
        await this.saveData();
        this.emit('dataChanged', { key, value });
    }
    
    /**
     * Menghapus key dari data
     * @param {string} key - Key yang akan dihapus
     */
    async delete(key) {
        this.checkInitialized();
        
        this.deleteNestedValue(this.data, key);
        await this.saveData();
        this.emit('dataChanged', { key, action: 'delete' });
    }
    
    /**
     * Menambahkan item ke array
     * @param {string} key - Key array
     * @param {*} item - Item yang akan ditambahkan
     */
    async push(key, item) {
        this.checkInitialized();
        
        const currentValue = this.get(key, []);
        if (!Array.isArray(currentValue)) {
            throw new Error(`Value at key "${key}" is not an array`);
        }
        
        currentValue.push(item);
        await this.set(key, currentValue);
    }
    
    /**
     * Update data dengan merge
     * @param {Object} newData - Data baru yang akan di-merge
     */
    async update(newData) {
        this.checkInitialized();
        
        this.data = this.deepMerge(this.data, newData);
        await this.saveData();
        this.emit('dataChanged', { data: newData, action: 'update' });
    }
    
    /**
     * Reset semua data
     * @param {Object} initialData - Data awal (optional)
     */
    async reset(initialData = {}) {
        this.checkInitialized();
        
        this.data = { ...initialData };
        await this.saveData();
        this.emit('dataChanged', { action: 'reset' });
    }
    
    /**
     * Membuat backup manual
     * @returns {string} Path file backup
     */
    async createBackup() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFileName = `backup_${timestamp}.json`;
            const backupPath = path.join(this.backupDir, backupFileName);
            
            const dataString = JSON.stringify(this.data, null, 2);
            await fs.writeFile(backupPath, dataString, 'utf8');
            
            // Bersihkan backup lama
            await this.cleanOldBackups();
            
            this.emit('backup', backupPath);
            return backupPath;
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }
    
    /**
     * Restore data dari file backup
     * @param {string} backupPath - Path ke file backup
     */
    async restoreFromBackup(backupPath) {
        try {
            const rawData = await fs.readFile(backupPath, 'utf8');
            this.data = JSON.parse(rawData);
            await this.saveData();
            
            this.emit('dataRestored', backupPath);
            console.log(`[JSONManager]: Data restored from ${backupPath}`);
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }
    
    /**
     * Restore dari backup terbaru
     * @returns {boolean} True jika berhasil restore
     */
    async restoreFromLatestBackup() {
        try {
            const backups = await this.getBackupList();
            if (backups.length === 0) {
                return false;
            }
            
            const latestBackup = backups[0].path;
            await this.restoreFromBackup(latestBackup);
            return true;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Mendapatkan list backup yang tersedia
     * @returns {Array} List backup dengan info file
     */
    async getBackupList() {
        try {
            const files = await fs.readdir(this.backupDir);
            const backups = [];
            
            for (const file of files) {
                if (file.startsWith('backup_') && file.endsWith('.json')) {
                    const filePath = path.join(this.backupDir, file);
                    const stats = await fs.stat(filePath);
                    
                    backups.push({
                        filename: file,
                        path: filePath,
                        size: stats.size,
                        created: stats.mtime
                    });
                }
            }
            
            // Sort by creation time (newest first)
            return backups.sort((a, b) => b.created - a.created);
        } catch (error) {
            return [];
        }
    }
    
    /**
     * Mulai auto backup
     */
    startAutoBackup() {
        if (this.backupTimer) {
            clearInterval(this.backupTimer);
        }
        
        this.backupTimer = setInterval(async () => {
            try {
                await this.createBackup();
            } catch (error) {
                this.emit('error', error);
            }
        }, this.backupInterval);
        
        console.log(`[JSONManager]: Auto backup started (every ${this.backupInterval / (60 * 60 * 1000)} hours)`);
    }
    
    /**
     * Hentikan auto backup
     */
    stopAutoBackup() {
        if (this.backupTimer) {
            clearInterval(this.backupTimer);
            this.backupTimer = null;
            console.log(`[JSONManager]: Auto backup stopped`);
        }
    }
    
    /**
     * Tutup JSONManager dan cleanup resources
     */
    async close() {
        this.stopAutoBackup();
        await this.saveData();
        this.emit('closed');
        console.log(`[JSONManager]: Closed successfully`);
    }
    
    // === UTILITY METHODS ===
    
    async ensureBackupDir() {
        try {
            await fs.access(this.backupDir);
        } catch {
            await fs.mkdir(this.backupDir, { recursive: true });
        }
    }
    
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
    
    checkInitialized() {
        if (!this.isInitialized) {
            throw new Error('JSONManager not initialized. Call init() first.');
        }
    }
    
    getNestedValue(obj, key, defaultValue) {
        const keys = key.split('.');
        let current = obj;
        
        for (const k of keys) {
            if (current === null || current === undefined || !current.hasOwnProperty(k)) {
                return defaultValue;
            }
            current = current[k];
        }
        
        return current;
    }
    
    setNestedValue(obj, key, value) {
        const keys = key.split('.');
        const lastKey = keys.pop();
        let current = obj;
        
        for (const k of keys) {
            if (!current[k] || typeof current[k] !== 'object') {
                current[k] = {};
            }
            current = current[k];
        }
        
        current[lastKey] = value;
    }
    
    deleteNestedValue(obj, key) {
        const keys = key.split('.');
        const lastKey = keys.pop();
        let current = obj;
        
        for (const k of keys) {
            if (!current[k]) return;
            current = current[k];
        }
        
        delete current[lastKey];
    }
    
    deepMerge(target, source) {
        const result = { ...target };
        
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        
        return result;
    }
    
    async cleanOldBackups() {
        try {
            const backups = await this.getBackupList();
            
            if (backups.length > this.maxBackups) {
                const toDelete = backups.slice(this.maxBackups);
                
                for (const backup of toDelete) {
                    await fs.unlink(backup.path);
                }
                
                console.log(`[JSONManager]: Cleaned ${toDelete.length} old backups`);
            }
        } catch (error) {
            this.emit('error', error);
        }
    }
}

export default JSONManager;