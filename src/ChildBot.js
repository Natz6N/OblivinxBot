// src/Clients/ChildBot/ChildBotManager.js
import { makeWASocket, useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";
import Pino from "pino";
import qrcode from "qrcode-terminal";
import * as Boom from "@hapi/boom";
import path from "path";
import { fileURLToPath } from "url";
import EventEmitter from "events";
import { createMessageHandler } from "../messageClients.js";
import { MessageRegistry } from "../RegistryCommands.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ChildBot extends EventEmitter {
  constructor(botId, config, logger, parentQueue) {
    super();
    this.botId = botId;
    this.config = config;
    this.logger = logger;
    this.parentQueue = parentQueue;
    this.sock = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.authPath = `__child_auth_${botId}`;
    this.reconnectTimer = null;
    this.startTime = null;
    
    // Child bot specific settings
    this.settings = {
      prefix: config.prefix || "!",
      name: config.name || `ChildBot-${botId}`,
      description: config.description || "Child Bot Instance",
      enabled: config.enabled !== false,
      autoReconnect: config.autoReconnect !== false,
      ...config
    };
  }

  async initialize() {
    if (!this.settings.enabled) {
      this.logger.info(`🤖 Child Bot ${this.botId} is disabled`);
      return false;
    }

    try {
      this.logger.info(`🚀 Initializing Child Bot ${this.botId}...`);
      
      // Setup authentication
      const { state, saveCreds } = await useMultiFileAuthState(this.authPath);

      // Create socket with child bot specific config
      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: Pino({ level: "silent" }),
        browser: [`ChildBot-${this.botId}`, "Chrome", "120.0.6099.109"],
        
        // Connection options
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 10000,
        markOnlineOnConnect: true,
        syncFullHistory: false,
        
        // Performance optimizations
        maxMsgRetryCount: 3,
        retryRequestDelayMs: 250,
        
        // Custom options for child bot
        options: {
          headers: {
            "User-Agent": `ChildBot-${this.botId}/1.0.0 WhatsApp/2.23.24.76`,
          },
        },
      });

      // Setup message registry for child bot
      this.registry = new MessageRegistry(this.sock, this.logger, {
        prefix: this.settings.prefix,
        owners: this.settings.owners || [],
        adminBypass: this.settings.adminBypass || false,
      });

      // Setup event handlers
      this.setupEventHandlers(saveCreds);

      return true;
    } catch (error) {
      this.logger.error(`💥 Failed to initialize Child Bot ${this.botId}:`, error);
      this.emit('error', { botId: this.botId, error });
      return false;
    }
  }

  setupEventHandlers(saveCreds) {
    // Credentials update
    this.sock.ev.on("creds.update", saveCreds);

    // Connection updates
    this.sock.ev.on("connection.update", async (update) => {
      await this.handleConnectionUpdate(update);
    });

    // Message handling
    const messageHandler = createMessageHandler(
      this.sock,
      this.registry,
      this.logger,
      new Map(), // groupCache
      this.parentQueue
    );

    this.sock.ev.on("messages.upsert", async (messageUpdate) => {
      try {
        // Add child bot identifier to messages
        messageUpdate.childBotId = this.botId;
        await messageHandler(messageUpdate);
      } catch (error) {
        this.logger.error(`Error in Child Bot ${this.botId} message handler:`, error);
      }
    });

    // Error handling
    this.sock.ev.on("CB:iq-error", (error) => {
      this.logger.warn(`Child Bot ${this.botId} IQ Error:`, error);
    });

    this.sock.ev.on("CB:stream-error", (error) => {
      this.logger.error(`Child Bot ${this.botId} Stream Error:`, error);
    });
  }

  async handleConnectionUpdate(update) {
    const { connection, lastDisconnect, qr } = update;

    try {
      if (qr) {
        this.logger.info(`📱 Child Bot ${this.botId} QR Code received`);
        console.log(`\n--- Child Bot ${this.botId} QR Code ---`);
        qrcode.generate(qr, { small: true });
        this.emit('qr', { botId: this.botId, qr });
      }

      switch (connection) {
        case "connecting":
          this.logger.info(`🔄 Child Bot ${this.botId} connecting...`);
          this.emit('connecting', { botId: this.botId });
          break;

        case "open":
          await this.handleConnectionOpen();
          break;

        case "close":
          await this.handleConnectionClose(lastDisconnect);
          break;
      }
    } catch (error) {
      this.logger.error(`Error handling connection update for Child Bot ${this.botId}:`, error);
    }
  }

  async handleConnectionOpen() {
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.startTime = Date.now();
    
    this.logger.info(`✅ Child Bot ${this.botId} connected successfully!`);
    
    // Get bot info
    const botInfo = {
      botId: this.botId,
      name: this.settings.name,
      number: this.sock.user?.id?.split(':')[0],
      jid: this.sock.user?.id,
      startTime: this.startTime,
    };

    this.emit('connected', botInfo);

    // Send startup message if configured
    if (this.settings.startupMessage && this.settings.notifyJid) {
      try {
        await this.sock.sendMessage(this.settings.notifyJid, {
          text: `🤖 ${this.settings.name} is now online!\nBot ID: ${this.botId}\nTime: ${new Date().toLocaleString()}`
        });
      } catch (error) {
        this.logger.warn(`Failed to send startup message for Child Bot ${this.botId}:`, error.message);
      }
    }
  }

  async handleConnectionClose(lastDisconnect) {
    this.isConnected = false;
    
    const statusCode = lastDisconnect?.error?.output?.statusCode;
    const errorMessage = lastDisconnect?.error?.message || "Unknown error";
    
    this.logger.warn(`Child Bot ${this.botId} connection closed: ${errorMessage} (Code: ${statusCode})`);

    // Handle specific error codes
    if (statusCode === DisconnectReason.loggedOut) {
      this.logger.info(`🚪 Child Bot ${this.botId} logged out - requires QR scan`);
      this.emit('loggedOut', { botId: this.botId });
      return;
    }

    if (statusCode === DisconnectReason.restartRequired || statusCode === 405) {
      this.logger.info(`🔄 Child Bot ${this.botId} restart required - clearing auth`);
      await this.clearSession();
    }

    // Attempt reconnection if enabled
    if (this.settings.autoReconnect && this.shouldReconnect(statusCode)) {
      await this.attemptReconnection();
    } else {
      this.logger.error(`❌ Child Bot ${this.botId} max reconnection attempts reached`);
      this.emit('disconnected', { botId: this.botId, permanent: true });
    }
  }

  shouldReconnect(statusCode) {
    const noReconnectCodes = [
      DisconnectReason.loggedOut,
      DisconnectReason.banned,
      DisconnectReason.blocked,
    ];

    return (
      this.reconnectAttempts < this.maxReconnectAttempts &&
      !noReconnectCodes.includes(statusCode)
    );
  }

  async attemptReconnection() {
    this.reconnectAttempts++;
    const delay = Math.min(5000 * this.reconnectAttempts, 30000);

    this.logger.info(
      `🔄 Child Bot ${this.botId} reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`
    );

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.initialize();
      } catch (error) {
        this.logger.error(`Child Bot ${this.botId} reconnection failed:`, error);
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          await this.attemptReconnection();
        }
      }
    }, delay);
  }

  async clearSession() {
    try {
      const fs = await import("fs");
      if (fs.existsSync(this.authPath)) {
        fs.rmSync(this.authPath, { recursive: true, force: true });
        this.logger.info(`🧹 Child Bot ${this.botId} auth session cleared`);
      }
    } catch (error) {
      this.logger.warn(`Failed to clear session for Child Bot ${this.botId}:`, error.message);
    }
  }

  async sendMessage(jid, message) {
    if (!this.isConnected || !this.sock) {
      throw new Error(`Child Bot ${this.botId} is not connected`);
    }

    try {
      return await this.sock.sendMessage(jid, message);
    } catch (error) {
      this.logger.error(`Failed to send message from Child Bot ${this.botId}:`, error);
      throw error;
    }
  }

  async stop() {
    this.logger.info(`🛑 Stopping Child Bot ${this.botId}...`);
    
    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Close socket connection
    if (this.sock && typeof this.sock.end === 'function') {
      try {
        await this.sock.end();
      } catch (error) {
        this.logger.warn(`Error closing Child Bot ${this.botId} socket:`, error.message);
      }
    }

    this.isConnected = false;
    this.emit('stopped', { botId: this.botId });
    this.logger.info(`✅ Child Bot ${this.botId} stopped`);
  }

  getStatus() {
    const uptime = this.startTime ? Date.now() - this.startTime : 0;
    
    return {
      botId: this.botId,
      name: this.settings.name,
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      uptime: this.formatUptime(uptime),
      startTime: this.startTime,
      settings: { ...this.settings },
      number: this.sock?.user?.id?.split(':')[0] || null,
    };
  }

  formatUptime(uptime) {
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}

export class ChildBotManager extends EventEmitter {
  constructor(logger, parentQueue, config = {}) {
    super();
    this.logger = logger;
    this.parentQueue = parentQueue;
    this.config = config;
    this.childBots = new Map();
    this.isRunning = false;
  }

  async initialize(botConfigs = []) {
    this.logger.info("🚀 Initializing Child Bot Manager...");
    
    try {
      for (const botConfig of botConfigs) {
        await this.createChildBot(botConfig.id, botConfig);
      }
      
      this.isRunning = true;
      this.logger.info(`✅ Child Bot Manager initialized with ${this.childBots.size} bots`);
      this.emit('initialized', { totalBots: this.childBots.size });
      
      return true;
    } catch (error) {
      this.logger.error("💥 Failed to initialize Child Bot Manager:", error);
      return false;
    }
  }

  async createChildBot(botId, config = {}) {
    if (this.childBots.has(botId)) {
      throw new Error(`Child Bot with ID ${botId} already exists`);
    }

    const childBot = new ChildBot(botId, config, this.logger, this.parentQueue);
    
    // Setup event forwarding
    childBot.on('connected', (botInfo) => {
      this.logger.info(`🎉 Child Bot ${botId} connected successfully`);
      this.emit('childConnected', botInfo);
    });

    childBot.on('disconnected', (info) => {
      this.logger.warn(`❌ Child Bot ${botId} disconnected`);
      this.emit('childDisconnected', info);
    });

    childBot.on('error', (info) => {
      this.logger.error(`💥 Child Bot ${botId} error:`, info.error);
      this.emit('childError', info);
    });

    childBot.on('qr', (info) => {
      this.emit('childQR', info);
    });

    this.childBots.set(botId, childBot);
    
    // Initialize the child bot
    const success = await childBot.initialize();
    if (!success) {
      this.childBots.delete(botId);
      throw new Error(`Failed to initialize Child Bot ${botId}`);
    }

    this.logger.info(`✅ Child Bot ${botId} created and initialized`);
    return childBot;
  }

  async removeChildBot(botId) {
    const childBot = this.childBots.get(botId);
    if (!childBot) {
      throw new Error(`Child Bot with ID ${botId} not found`);
    }

    await childBot.stop();
    this.childBots.delete(botId);
    
    this.logger.info(`🗑️ Child Bot ${botId} removed`);
    this.emit('childRemoved', { botId });
  }

  getChildBot(botId) {
    return this.childBots.get(botId);
  }

  getAllChildBots() {
    return Array.from(this.childBots.values());
  }

  getChildBotStatus(botId) {
    const childBot = this.childBots.get(botId);
    return childBot ? childBot.getStatus() : null;
  }

  getAllStatus() {
    const status = {
      isRunning: this.isRunning,
      totalBots: this.childBots.size,
      connectedBots: 0,
      disconnectedBots: 0,
      bots: []
    };

    for (const childBot of this.childBots.values()) {
      const botStatus = childBot.getStatus();
      status.bots.push(botStatus);
      
      if (botStatus.isConnected) {
        status.connectedBots++;
      } else {
        status.disconnectedBots++;
      }
    }

    return status;
  }

  async broadcastMessage(message, excludeBots = []) {
    const results = [];
    
    for (const [botId, childBot] of this.childBots) {
      if (excludeBots.includes(botId) || !childBot.isConnected) {
        continue;
      }

      try {
        await childBot.sendMessage(message.jid, message.content);
        results.push({ botId, success: true });
      } catch (error) {
        results.push({ botId, success: false, error: error.message });
      }
    }

    return results;
  }

  async restartChildBot(botId) {
    const childBot = this.childBots.get(botId);
    if (!childBot) {
      throw new Error(`Child Bot with ID ${botId} not found`);
    }

    this.logger.info(`🔄 Restarting Child Bot ${botId}...`);
    
    await childBot.stop();
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    
    const success = await childBot.initialize();
    if (!success) {
      throw new Error(`Failed to restart Child Bot ${botId}`);
    }

    this.logger.info(`✅ Child Bot ${botId} restarted successfully`);
    return true;
  }

  async restartAllChildBots() {
    this.logger.info("🔄 Restarting all child bots...");
    
    const results = [];
    for (const botId of this.childBots.keys()) {
      try {
        await this.restartChildBot(botId);
        results.push({ botId, success: true });
      } catch (error) {
        results.push({ botId, success: false, error: error.message });
      }
    }

    return results;
  }

  async stop() {
    this.logger.info("🛑 Stopping Child Bot Manager...");
    
    const stopPromises = [];
    for (const childBot of this.childBots.values()) {
      stopPromises.push(childBot.stop());
    }

    await Promise.allSettled(stopPromises);
    
    this.childBots.clear();
    this.isRunning = false;
    
    this.logger.info("✅ Child Bot Manager stopped");
    this.emit('stopped');
  }
}