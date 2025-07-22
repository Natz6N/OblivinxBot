
import { botLogger } from "../bot.js";
/**
 * Kelas untuk mengelola antrian pesan dengan kapasitas tinggi
 * Menggunakan kombinasi dari in-memory queue dan worker yang efisien
 */
class MessageQueue {
  constructor(options = {}) {
    this.queue = [];
    this.processingQueue = new Map(); // Untuk pelacakan pesan yang sedang diproses
    this.maxConcurrentProcessing = options.maxConcurrent || 25; // Kurangi jumlah pesan yang diproses bersamaan
    this.maxQueueSize = options.maxQueueSize || 5000; // Batas lebih wajar untuk antrian
    this.processingDelay = options.processingDelay || 50; // Tingkatkan delay antar pemrosesan pesan
    this.rateLimitDelay = options.rateLimitDelay || 3000; // Delay jika terkena rate limit
    this.rateLimitTracker = new Map(); // Untuk melacak rate limit berdasarkan target
    this.priorityLevels = {
      OWNER: 0,      // Prioritas tertinggi (pemilik bot)
      ADMIN: 1,      // Admin grup
      PREMIUM: 2,    // Pengguna premium
      NORMAL: 3,     // Pengguna biasa
      LOW: 4         // Prioritas rendah
    };
    this.isProcessing = false;
    this.messageHandlers = new Map();
    this.statistics = {
      totalReceived: 0,
      totalProcessed: 0,
      totalErrors: 0,
      totalRateLimited: 0,
      startTime: Date.now(),
      highestQueueLength: 0
    };
    this.defaultHandler = null;
    
    // Interval untuk memantau status antrian
    this.monitorInterval = setInterval(() => this.monitorQueueStatus(), 30000);
    
    // Interval untuk membersihkan rate limit tracker
    this.cleanupInterval = setInterval(() => this.cleanupRateLimitTracker(), 60000);
  }
  
  /**
   * Membersihkan rate limit tracker secara berkala
   * @private
   */
  cleanupRateLimitTracker() {
    const now = Date.now();
    let count = 0;
    
    for (const [key, timestamp] of this.rateLimitTracker.entries()) {
      if (now - timestamp > 60000) { // Lebih dari 1 menit
        this.rateLimitTracker.delete(key);
        count++;
      }
    }
    
    if (count > 0) {
      botLogger.debug(`Cleaned up ${count} old entries from rate limit tracker`);
    }
  }
  
  /**
   * Mendaftarkan handler untuk tipe pesan tertentu
   * @param {string} type - Tipe pesan (misalnya: 'text', 'image', 'command', dll)
   * @param {Function} handler - Fungsi penanganan pesan
   */
  registerHandler(type, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Handler harus berupa fungsi');
    }
    this.messageHandlers.set(type, handler);
    botLogger.info(`Registered handler for message type: ${type}`);
  }
  
  /**
   * Mendaftarkan handler default untuk pesan yang tidak memiliki handler khusus
   * @param {Function} handler - Fungsi penanganan pesan default
   */
  setDefaultHandler(handler) {
    if (typeof handler !== 'function') {
      throw new Error('Default handler harus berupa fungsi');
    }
    this.defaultHandler = handler;
    botLogger.info('Default message handler has been set');
  }
  
  /**
   * Menambahkan pesan ke antrian dengan pengecekan duplikat
   * @param {Object} message - Objek pesan WhatsApp yang telah diproses
   * @param {Object} metadata - Metadata tambahan (termasuk prioritas)
   * @returns {string} ID pesan dalam antrian
   */
  enqueue(message, metadata = {}) {
    // Buat ID unik untuk pesan
    const messageId = metadata.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Cek duplicate message dalam waktu singkat (debouncing)
    if (message.messageText && this.isDuplicateMessage(message)) {
      botLogger.debug(`Duplicate message detected: ${message.messageText.substring(0, 30)}...`);
      return null;
    }
    
    // Tentukan prioritas pesan
    const priority = this.determineMessagePriority(message, metadata);
    
    // Tentukan tipe pesan
    const messageType = this.determineMessageType(message);
    
    // Buat objek pesan yang akan dimasukkan ke antrian
    const queuedMessage = {
      id: messageId,
      message,
      metadata: {
        ...metadata,
        receivedAt: Date.now(),
        priority,
        messageType,
        attempts: 0 // Untuk retry jika gagal
      }
    };
    
    // Periksa kapasitas antrian
    if (this.queue.length >= this.maxQueueSize) {
      botLogger.warn(`Queue is full (${this.queue.length} messages). Dropping message with lowest priority.`);
      // Cari pesan dengan prioritas terendah untuk dihapus
      const lowestPriorityIndex = this.findLowestPriorityMessageIndex();
      if (lowestPriorityIndex !== -1 && this.queue[lowestPriorityIndex].metadata.priority > priority) {
        // Hapus pesan dengan prioritas lebih rendah
        this.queue.splice(lowestPriorityIndex, 1);
      } else {
        // Jika tidak ada pesan dengan prioritas lebih rendah, tolak pesan baru
        botLogger.error(`Cannot enqueue message: ${messageId}. Queue is full and message priority is not high enough.`);
        return null;
      }
    }
    
    // Masukkan pesan ke antrian
    this.queue.push(queuedMessage);
    
    // Update statistik
    this.statistics.totalReceived++;
    this.statistics.highestQueueLength = Math.max(this.statistics.highestQueueLength, this.queue.length);
    
    // Mulai pemrosesan jika belum dimulai
    if (!this.isProcessing) {
      this.processQueue();
    }
    
    return messageId;
  }
  
  /**
   * Cek apakah pesan adalah duplikat dari pesan yang baru saja diterima
   * @private
   */
  isDuplicateMessage(message) {
    if (!message.messageText) return false;
    
    // Buat fingerprint sederhana untuk pesan
    const fingerprint = `${message.sender}:${message.messageText}`;
    const now = Date.now();
    
    // Cek apakah fingerprint sudah ada di tracker dan belum kedaluwarsa (5 detik)
    const lastSeen = this.rateLimitTracker.get(fingerprint);
    if (lastSeen && now - lastSeen < 5000) {
      return true;
    }
    
    // Catat fingerprint baru
    this.rateLimitTracker.set(fingerprint, now);
    return false;
  }
  
  /**
   * Menentukan prioritas pesan berdasarkan pengirim dan tipe
   * @private
   */
  determineMessagePriority(message, metadata) {
    // Cek apakah pesan berasal dari owner
    if (message.sender && global.Oblixn && global.Oblixn.isOwner && global.Oblixn.isOwner(message.sender)) {
      return this.priorityLevels.OWNER;
    }
    
    // Cek apakah pengirim adalah admin grup
    if (message.isGroup && message.isAdmin) {
      return this.priorityLevels.ADMIN;
    }
    
    // Cek apakah pengirim adalah user premium (bisa disesuaikan dengan implementasi user premium)
    if (metadata.isPremium) {
      return this.priorityLevels.PREMIUM;
    }
    
    // Cek apakah ini adalah pesan command
    if (message.messageText && message.messageText.startsWith('!')) {
      return this.priorityLevels.NORMAL;
    }
    
    // Pesan biasa
    return this.priorityLevels.LOW;
  }
  
  /**
   * Menentukan tipe pesan (text, image, sticker, dll.)
   * @private
   */
  determineMessageType(message) {
    // Cek jika ini adalah pesan command
    if (message.messageText && message.messageText.startsWith('!')) {
      return 'command';
    }
    
    // Cek berdasarkan konten pesan
    if (message.message) {
      if (message.message.imageMessage) return 'image';
      if (message.message.videoMessage) return 'video';
      if (message.message.audioMessage) return 'audio';
      if (message.message.stickerMessage) return 'sticker';
      if (message.message.documentMessage) return 'document';
      if (message.message.locationMessage) return 'location';
      if (message.message.contactMessage) return 'contact';
    }
    
    // Default ke text jika tidak ada yang cocok
    return 'text';
  }
  
  /**
   * Mencari indeks pesan dengan prioritas terendah
   * @private
   */
  findLowestPriorityMessageIndex() {
    let lowestPriority = -1;
    let lowestPriorityIndex = -1;
    
    for (let i = 0; i < this.queue.length; i++) {
      const priority = this.queue[i].metadata.priority;
      if (lowestPriority === -1 || priority > lowestPriority) {
        lowestPriority = priority;
        lowestPriorityIndex = i;
      }
    }
    
    return lowestPriorityIndex;
  }
  
  /**
   * Memulai pemrosesan antrian pesan dengan mekanisme throttling untuk mencegah rate-limit
   */
  async processQueue() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    while (this.queue.length > 0) {
      // Jika sudah mencapai batas pemrosesan bersamaan, tunggu sampai ada slot kosong
      if (this.processingQueue.size >= this.maxConcurrentProcessing) {
        await new Promise(resolve => setTimeout(resolve, this.processingDelay));
        continue;
      }
      
      // Urutkan antrian berdasarkan prioritas
      this.queue.sort((a, b) => a.metadata.priority - b.metadata.priority);
      
      // Ambil pesan dari antrian
      const queuedMessage = this.queue.shift();
      
      // Cek rate limit berdasarkan target/chat
      const target = queuedMessage.message.chat || 'global';
      if (this.isRateLimited(target)) {
        // Jika rate limited, kembalikan ke antrian dengan prioritas lebih rendah
        queuedMessage.metadata.priority += 0.5; // Turunkan prioritas sedikit
        this.queue.push(queuedMessage);
        await new Promise(resolve => setTimeout(resolve, 200)); // Tunggu sebentar
        continue;
      }
      
      // Update rate limit tracker
      this.updateRateLimit(target);
      
      // Tambahkan ke daftar pesan yang sedang diproses
      this.processingQueue.set(queuedMessage.id, queuedMessage);
      
      // Proses pesan secara asynchronous
      this.processMessage(queuedMessage)
        .catch(error => {
          const errorMsg = error.message || 'Unknown error';
          
          if (errorMsg.includes('rate-overlimit')) {
            this.statistics.totalRateLimited++;
            botLogger.warn(`Rate limit reached for message ${queuedMessage.id}, target: ${target}`);
            
            // Tambahkan delay yang lebih lama untuk target ini
            this.setRateLimit(target, this.rateLimitDelay * 2);
            
            // Coba lagi nanti jika belum mencapai batas retry
            if (queuedMessage.metadata.attempts < 3) {
              queuedMessage.metadata.attempts++;
              queuedMessage.metadata.priority += 1; // Kurangi prioritas lebih banyak
              this.queue.push(queuedMessage);
            }
          } else {
            botLogger.error(`Error processing message ${queuedMessage.id}: ${errorMsg}`);
            this.statistics.totalErrors++;
          }
        })
        .finally(() => {
          // Hapus dari daftar pesan yang sedang diproses
          this.processingQueue.delete(queuedMessage.id);
        });
      
      // Berikan sedikit delay untuk menghindari throttling
      await new Promise(resolve => setTimeout(resolve, this.processingDelay));
    }
    
    this.isProcessing = false;
  }
  
  /**
   * Memeriksa apakah target sedang dalam rate limit
   * @private
   */
  isRateLimited(target) {
    const lastRequest = this.rateLimitTracker.get(`limit:${target}`);
    if (!lastRequest) return false;
    
    const now = Date.now();
    return (now - lastRequest.timestamp) < lastRequest.delay;
  }
  
  /**
   * Update rate limit tracker untuk target tertentu
   * @private
   */
  updateRateLimit(target) {
    const now = Date.now();
    const existing = this.rateLimitTracker.get(`limit:${target}`);
    
    this.rateLimitTracker.set(`limit:${target}`, {
      timestamp: now,
      delay: existing && existing.rateLimited ? existing.delay : this.processingDelay,
      rateLimited: false
    });
  }
  
  /**
   * Set target sebagai rate limited dengan delay tertentu
   * @private
   */
  setRateLimit(target, delay) {
    this.rateLimitTracker.set(`limit:${target}`, {
      timestamp: Date.now(),
      delay: delay,
      rateLimited: true
    });
    
    botLogger.warn(`Rate limit set for ${target} with delay ${delay}ms`);
  }
  
  /**
   * Memproses pesan individual dengan penanganan error yang lebih baik
   * @private
   */
  async processMessage(queuedMessage) {
    try {
      const { message, metadata } = queuedMessage;
      const { messageType } = metadata;
      
      // Cari handler untuk tipe pesan ini
      const handler = this.messageHandlers.get(messageType) || this.defaultHandler;
      
      if (!handler) {
        botLogger.warn(`No handler for message type: ${messageType}`);
        return;
      }
      
      // Jalankan handler dengan timeout untuk mencegah handler hang
      await Promise.race([
        handler(message, metadata),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Handler timeout')), 30000)
        )
      ]);
      
      // Update statistik
      this.statistics.totalProcessed++;
      
    } catch (error) {
      // Increment retry count
      queuedMessage.metadata.attempts++;
      
      // Mencoba ulang jika belum mencapai batas maksimum
      if (queuedMessage.metadata.attempts < 3) {
        botLogger.warn(`Retrying message ${queuedMessage.id} (Attempt: ${queuedMessage.metadata.attempts})`);
        this.queue.push(queuedMessage);
      } else {
        botLogger.error(`Failed to process message ${queuedMessage.id} after ${queuedMessage.metadata.attempts} attempts: ${error.message}`);
        this.statistics.totalErrors++;
      }
      
      throw error;
    }
  }
  
  /**
   * Memantau status antrian dan mencatat statistik
   * @private
   */
  monitorQueueStatus() {
    const uptime = (Date.now() - this.statistics.startTime) / 1000; // dalam detik
    const messagesPerSecond = this.statistics.totalProcessed / uptime;
    
    botLogger.info(`
Queue Status:
- Queue Size: ${this.queue.length}
- Currently Processing: ${this.processingQueue.size}
- Total Received: ${this.statistics.totalReceived}
- Total Processed: ${this.statistics.totalProcessed}
- Total Errors: ${this.statistics.totalErrors}
- Total Rate Limited: ${this.statistics.totalRateLimited}
- Processing Rate: ${messagesPerSecond.toFixed(2)} msg/s
- Highest Queue Length: ${this.statistics.highestQueueLength}
    `);
  }
  
  /**
   * Mendapatkan statistik antrian
   * @returns {Object} Statistik antrian
   */
  getStatistics() {
    const now = Date.now();
    const uptime = (now - this.statistics.startTime) / 1000; // dalam detik
    
    return {
      uptime,
      totalReceived: this.statistics.totalReceived,
      totalProcessed: this.statistics.totalProcessed,
      totalErrors: this.statistics.totalErrors,
      currentQueueLength: this.queue.length,
      currentlyProcessing: this.processingQueue.size,
      highestQueueLength: this.statistics.highestQueueLength
    };
  }
  
  /**
   * Membersihkan resource ketika tidak digunakan
   */
  cleanup() {
    clearInterval(this.monitorInterval);
    clearInterval(this.cleanupInterval);
  }
}

// Membuat instance tunggal untuk digunakan di seluruh aplikasi
export default MessageQueue;
