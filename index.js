import fileManager from "../FileManager.js";
import initBot, { botState, getBotStatus, recoverBot } from "./src/bot.js";
import MessageQueue from "./src/Clients/MessageQueue.js";
import config from "./src/config.js";

// Enhanced queue configuration for better stability
const queue = new MessageQueue({
  maxConcurrent: 12, // Reduced for better stability
  maxQueueSize: 2500, // Increased queue size
  retryAttempts: 3, // Add retry attempts
  retryDelay: 1000, // Retry delay in ms
  processingTimeout: 30000, // 30 seconds timeout per message
});

// Enhanced command handler with better error handling
queue.registerHandler("command", async (msg) => {
  try {
    const { registry, messageText, sock, raw } = msg;

    // Validate required fields
    if (!registry || !messageText || !sock || !raw) {
      console.warn("⚠️ Incomplete message data received in command handler");
      return;
    }

    const messageInfo = {
      id: raw.key.id,
      sender: msg.sender,
      participant: raw.key.participant || msg.sender,
      text: messageText,
      timestamp: raw.messageTimestamp,
      isGroup: msg.isGroup,
      isAdmin: msg.isAdmin,
      messageType: "command",
      sock,
    };

    await registry.processMessage(messageInfo);
  } catch (error) {
    console.log("⚠️ Error in command handler:", {
      error: error.message,
      stack: error.stack,
      messageId: msg?.raw?.key?.id,
      sender: msg?.sender
    });
    
    // Increment error counter if botState is available
    if (botState) {
      botState.incrementCounter("errorCount");
    }
  }
});

// Enhanced default handler with better error handling
queue.setDefaultHandler(async (msg) => {
  try {
    // Validate message structure
    if (!msg || !msg.raw || !msg.sock) {
      console.warn("⚠️ Invalid message structure in default handler");
      return;
    }

    const messageInfo = {
      id: msg.raw.key.id,
      sender: msg.sender,
      participant: msg.raw.key.participant || msg.sender,
      text: msg.messageText || "",
      timestamp: msg.raw.messageTimestamp,
      isGroup: msg.isGroup || false,
      isAdmin: msg.isAdmin || false,
      messageType: msg.messageType || "text",
      sock: msg.sock,
    };

    // Import processMessage function dynamically to avoid circular imports
    const { processMessage } = await import("./src/Clients/messageClients.js");
    await processMessage(messageInfo, msg.sock.botLogger || console);
    
  } catch (error) {
    console.error("⚠️ Error in default message handler:", {
      error: error.message,
      stack: error.stack,
      messageId: msg?.raw?.key?.id,
      sender: msg?.sender
    });
    
    // Increment error counter if botState is available
    if (botState) {
      botState.incrementCounter("errorCount");
    }
  }
});

// Enhanced event listeners for queue
queue.on('error', (error) => {
  console.error("⚠️ Queue error:", {
    message: error.message,
    stack: error.stack?.substring(0, 300), // Limit stack trace length
    timestamp: new Date().toISOString()
  });
  
  if (botState) {
    botState.incrementCounter("errorCount");
  }
});

queue.on('full', () => {
  console.warn("⚠️ Message queue is full, some messages may be dropped");
  
  // Optional: Log queue statistics when full
  const stats = queue.getStatistics();
  console.warn("📊 Queue Statistics:", {
    currentSize: stats.currentQueueLength,
    processing: stats.currentlyProcessing,
    totalReceived: stats.totalReceived,
    totalProcessed: stats.totalProcessed,
    errors: stats.totalErrors
  });
});

queue.on('failed', ({ messageId, error, attempts }) => {
  console.error(`❌ Message failed: ${messageId} (error: ${error}, attempts: ${attempts})`);
});

queue.on('stopped', () => {
  console.info("🛑 Message queue stopped");
});

queue.on('started', () => {
  console.info("▶️ Message queue started");
});

// Function to validate configuration
function validateConfig() {
  const issues = [];
  
  // Validate pairing code configuration
  if (config.pairingCode?.enabled) {
    if (!config.pairingCode.phoneNumber) {
      issues.push("Pairing code enabled but no phone number provided");
    } else {
      const phoneNumber = config.pairingCode.phoneNumber.toString();
      if (!/^\d+$/.test(phoneNumber.replace(/[^0-9]/g, ''))) {
        issues.push("Invalid phone number format for pairing code");
      }
    }
  }
  
  // Validate basic bot configuration
  if (!config.prefix) {
    issues.push("Bot prefix not configured");
  }
  
  if (!config.ownerDB) {
    issues.push("Owner database not configured");
  }
  
  return issues;
}

// Enhanced initialization function
async function initializeBot() {
  try {
    console.log("🚀 Starting Oblivinx Bot initialization...");
    
    // Validate configuration first
    const configIssues = validateConfig();
    if (configIssues.length > 0) {
      console.warn("⚠️ Configuration issues detected:");
      configIssues.forEach(issue => console.warn(`  - ${issue}`));
    }
    
    // Log configuration status
    console.log("📱 Authentication method:", 
      config.pairingCode?.enabled ? 
      `Pairing Code (${config.pairingCode.phoneNumber ? "configured" : "not configured"})` : 
      "QR Code"
    );
    
    // Initialize databases with better error handling
    console.log("🗄️ Initializing databases...");
    await config.initDatabases();
    console.log("✅ Databases initialized successfully");
    
    // Start file cleanup service
    console.log("🧹 Starting file cleanup service...");
    const cleanupInterval = setInterval(() => {
      try {
        fileManager.cleanTempFiles();
      } catch (error) {
        console.warn("⚠️ File cleanup error:", error.message);
      }
    }, 10 * 60 * 1000); // Every 10 minutes
    
    // Store cleanup interval for later cleanup
    global.cleanupInterval = cleanupInterval;
    
    // Initialize bot with enhanced error handling
    console.log("🤖 Initializing bot connection...");
    await initBot(queue);
    
    // Setup bot state event listeners
    if (botState) {
      botState.on("connected", () => {
        config.apcb.log("✅ Bot connected successfully!");
        
        // Log current status
        const status = getBotStatus();
        
        config.apcb.log("📊 Bot Status:", {
          connection: status.status,
          uptime: status.uptime,
          memory: `${status.memoryUsage?.current || 0}MB`,
          errors: status.errors,
          reconnects: status.reconnects
        });
      });

      botState.on("requiresManualIntervention", ({ reason }) => {
        console.log(`⚠️ Manual intervention needed: ${reason}`);
        
        // You can add notification logic here
        // For example, send alert to admin, log to external service, etc.
        if (reason === "logged_out") {
          console.log("🔑 Please scan QR code or check pairing code configuration");
        }
      });
      
      botState.on("disconnected", ({ permanent }) => {
        if (permanent) {
          console.error("💥 Bot permanently disconnected - May require manual restart");
          // You could implement auto-restart logic here if needed
        }
      });
    }
    
    console.log("✅ Bot initialization completed successfully");
    
  } catch (error) {
    console.error("💥 Critical initialization error:", {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Attempt recovery if possible
    if (error.message.includes("515") || 
        error.message.includes("timeout") || 
        error.message.includes("network")) {
      
      console.log("🔄 Attempting automatic recovery...");
      
      setTimeout(async () => {
        try {
          await recoverBot(queue);
          console.log("✅ Automatic recovery successful");
        } catch (recoveryError) {
          console.error("💥 Automatic recovery failed:", recoveryError.message);
          console.log("🔄 Please restart the bot manually");
          process.exit(1);
        }
      }, 30000); // Wait 30 seconds before recovery
      
    } else {
      console.error("💥 Non-recoverable error - Exiting");
      process.exit(1);
    }
  }
}

// Enhanced cleanup function
function cleanup() {
  console.log("🧹 Performing cleanup...");
  
  try {
    // Stop and cleanup queue
    if (queue && typeof queue.cleanup === 'function') {
      queue.cleanup();
      console.log("✅ Message queue cleaned up");
    }
    
    // Clear file cleanup interval
    if (global.cleanupInterval) {
      clearInterval(global.cleanupInterval);
      console.log("✅ File cleanup service stopped");
    }
    
    // Clear any other intervals
    if (global.memoryManagementInterval) {
      clearInterval(global.memoryManagementInterval);
      console.log("✅ Memory management service stopped");
    }
    
    // Clear reconnect timer if exists
    if (global.reconnectTimer) {
      clearTimeout(global.reconnectTimer);
      console.log("✅ Reconnect timer cleared");
    }
    
    // Clear health monitoring interval
    if (global.healthInterval) {
      clearInterval(global.healthInterval);
      console.log("✅ Health monitoring stopped");
    }
    
    console.log("✅ Cleanup completed");
    
  } catch (error) {
    console.warn("⚠️ Cleanup error:", error.message);
  }
}

// Enhanced graceful shutdown
function gracefulShutdown(signal) {
  console.log(`\n🛑 Received ${signal} - Initiating graceful shutdown...`);
  
  // Prevent multiple shutdown attempts
  if (global.shuttingDown) {
    console.log("⚠️ Shutdown already in progress...");
    return;
  }
  global.shuttingDown = true;
  
  // Perform cleanup
  cleanup();
  
  // Force exit after timeout to prevent hanging
  const shutdownTimeout = setTimeout(() => {
    console.log("⏰ Shutdown timeout reached - Force exit");
    process.exit(1);
  }, 10000); // 10 seconds timeout
  
  // Try to exit gracefully
  setTimeout(() => {
    clearTimeout(shutdownTimeout);
    console.log("✅ Graceful shutdown completed");
    process.exit(0);
  }, 2000); // 2 seconds delay
}

// Health monitoring function
function startHealthMonitoring() {
  const healthInterval = setInterval(() => {
    try {
      const status = getBotStatus();
      const memUsage = process.memoryUsage();
      const queueStats = queue.getStatistics();
      
      // Log health metrics periodically (every 5 minutes)
      console.log("📊 Health Check:", {
        status: status.status,
        uptime: status.uptime,
        memory: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        errors: status.errors,
        consecutiveErrors: status.consecutiveErrors,
        reconnects: status.reconnects,
        queueSize: queueStats.currentQueueLength,
        queueProcessing: queueStats.currentlyProcessing,
        queueProcessed: queueStats.totalProcessed,
        queueErrors: queueStats.totalErrors,
        processingRate: `${queueStats.processingRate.toFixed(2)} msg/s`
      });
      
      // Alert on high error rates
      if (status.consecutiveErrors > 5) {
        console.warn(`⚠️ High error rate detected: ${status.consecutiveErrors} consecutive errors`);
      }
      
      // Alert on high memory usage
      const memMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      if (memMB > 400) {
        console.warn(`⚠️ High memory usage: ${memMB}MB`);
      }
      
      // Alert on large queue size
      if (queueStats.currentQueueLength > 1000) {
        console.warn(`⚠️ Large queue size: ${queueStats.currentQueueLength} messages`);
      }
      
      // Alert if bot is not running but should be
      if (status.status === 'disconnected' && !global.shuttingDown) {
        console.warn("⚠️ Bot appears to be disconnected - May need manual intervention");
      }
      
      // Alert if queue is stopped unexpectedly
      if (queueStats.isStopped && !global.shuttingDown) {
        console.warn("⚠️ Message queue is stopped unexpectedly - Attempting to restart");
        try {
          queue.start();
        } catch (error) {
          console.error("❌ Failed to restart queue:", error.message);
        }
      }
      
    } catch (error) {
      console.warn("⚠️ Health check error:", error.message);
    }
  }, 5 * 60 * 1000); // Every 5 minutes
  
  global.healthInterval = healthInterval;
}

// Enhanced error handlers for process
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT'));

process.on('uncaughtException', (error) => {
  console.error("💥 Uncaught Exception:", {
    message: error.message,
    stack: error.stack,
    name: error.name
  });
  
  // Try to log additional context
  if (botState) {
    console.error("🤖 Bot State:", {
      status: botState.state?.connectionStatus || 'unknown',
      errors: botState.state?.errorCount || 0,
      consecutiveErrors: botState.state?.consecutiveErrors || 0
    });
  }
  
  // Log queue state
  if (queue) {
    try {
      const queueStats = queue.getStatistics();
      console.error("📊 Queue State:", {
        size: queueStats.currentQueueLength,
        processing: queueStats.currentlyProcessing,
        errors: queueStats.totalErrors,
        isStopped: queueStats.isStopped
      });
    } catch (e) {
      console.error("❌ Failed to get queue stats:", e.message);
    }
  }
  
  // Don't exit immediately for certain recoverable errors
  const recoverableErrors = [
    'ENOTFOUND',
    'ECONNRESET', 
    'ETIMEDOUT',
    'socket hang up',
    'network',
    'rate-overlimit'
  ];
  
  const isRecoverable = recoverableErrors.some(errType => 
    error.message.toLowerCase().includes(errType.toLowerCase())
  );
  
  if (isRecoverable && !global.shuttingDown) {
    console.log("⚠️ Potentially recoverable error - Attempting to continue...");
    
    // Increment error counter
    if (botState) {
      botState.incrementCounter('errorCount');
      
      // If too many errors, shutdown
      if (botState.state.consecutiveErrors > 10) {
        console.error("💥 Too many consecutive errors - Initiating shutdown");
        gracefulShutdown('uncaughtException');
      }
    }
  } else {
    console.error("💥 Non-recoverable error - Initiating shutdown");
    gracefulShutdown('uncaughtException');
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error("💥 Unhandled Rejection:", {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
    promise: promise.toString().substring(0, 200) + '...' // Truncate for readability
  });
  
  // Increment error counter
  if (botState) {
    botState.incrementCounter('errorCount');
  }
  
  // Check if rejection is recoverable
  const reasonStr = String(reason).toLowerCase();
  const recoverableReasons = [
    'timeout',
    'network',
    'connection',
    'enotfound',
    'econnreset',
    '515',
    'overloaded',
    'rate-overlimit'
  ];
  
  const isRecoverable = recoverableReasons.some(errType => 
    reasonStr.includes(errType)
  );
  
  if (isRecoverable && !global.shuttingDown) {
    console.log("⚠️ Potentially recoverable rejection - Attempting to continue...");
    
    // If too many errors, consider shutdown
    if (botState && botState.state.consecutiveErrors > 15) {
      console.error("💥 Too many consecutive errors - Initiating shutdown");
      gracefulShutdown('unhandledRejection');
    }
  } else if (!global.shuttingDown) {
    console.error("💥 Non-recoverable rejection - Initiating shutdown");
    gracefulShutdown('unhandledRejection');
  }
});

// Handle memory warnings
process.on('warning', (warning) => {
  console.warn("⚠️ Process Warning:", {
    name: warning.name,
    message: warning.message,
    stack: warning.stack
  });
  
  // Handle memory warnings specifically
  if (warning.name === 'MaxListenersExceededWarning') {
    console.warn("⚠️ Too many event listeners - Potential memory leak");
    
    // Log event listener counts for debugging
    if (queue) {
      console.warn("📊 Queue Event Listeners:", queue.listenerCount('error'), 'error listeners');
    }
  }
});

// Enhanced main execution with better error handling
(async () => {
  try {
    // Display startup banner
    console.clear();
    startHealthMonitoring();
    await initializeBot();
    console.log("✅ Bot startup completed successfully!");
    
    // Log queue configuration
    const queueStats = queue.getStatistics();
    console.log("⚙️ Queue Configuration:", {
      maxConcurrent: queue.maxConcurrentProcessing,
      maxQueueSize: queue.maxQueueSize,
      processingDelay: `${queue.processingDelay}ms`,
      retryAttempts: queue.retryAttempts,
      currentSize: queueStats.currentQueueLength
    });
    
    console.log("─".repeat(67));
    
  } catch (error) {
    console.error("💥 Fatal startup error:", {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Final attempt at graceful shutdown
    cleanup();
    
    console.error("💥 Bot failed to start - Exiting");
    process.exit(1);
  }
})();

// Export utilities for external access
export {
  queue,
  initializeBot,
  cleanup,
  getBotStatus,
  validateConfig
};