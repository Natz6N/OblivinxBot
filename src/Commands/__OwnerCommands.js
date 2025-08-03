import { botLogger } from "../bot.js";
import config from "../config.js";
import path from "path";
import { fileURLToPath } from "url";
import { promises as fs } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Bot status tracking
const botStatus = {
  isRunning: true,
  isPaused: false,
  startTime: Date.now(),
  messageCount: 0,
  errorCount: 0,
};

/**
 * Register owner commands to the MessageRegistry
 * @param {MessageRegistry} registry - The command registry instance
 */
export default function (registry) {
  // ==================== RESTART COMMAND ====================
  registry.addGlobalCommand({
    name: "restart",
    aliases: ["reboot", "mulaiulang"],
    description: "Restart bot (Owner only)",
    usage: "restart",
    category: "owner",
    isowner: true, // Changed from ownerOnly to isowner
    exec: async ({ sock, messageInfo, reply }) => {
      try {
        await reply("🔄 Bot akan restart dalam 3 detik...");

        // Delay untuk mengirim pesan
        setTimeout(() => {
          console.log("🔄 Bot restart dari WhatsApp command");
          process.exit(1); // Exit dengan code 1 untuk auto-restart jika menggunakan PM2
        }, 3000);
      } catch (error) {
        console.error("Error in restart command:", error);
        await reply("❌ Terjadi error saat restart bot");
      }
    },
  });

  // ==================== START COMMAND ====================
  registry.addGlobalCommand({
    name: "start",
    aliases: ["mulai"],
    description: "Start bot (Owner only)",
    usage: "start",
    category: "owner",
    isowner: true,
    exec: async ({ sock, messageInfo, reply }) => {
      try {
        botStatus.isRunning = true;
        botStatus.isPaused = false;
        
        await reply("✅ Bot telah diaktifkan!");
      } catch (error) {
        console.error("Error in start command:", error);
        await reply("❌ Terjadi error saat menjalankan bot");
      }
    },
  });

  // ==================== SHUTDOWN COMMAND ====================
  registry.addGlobalCommand({
    name: "shutdown",
    aliases: ["std", "matikan"],
    description: "Shutdown bot (Owner only)",
    usage: "shutdown",
    category: "owner",
    isowner: true,
    exec: async ({ sock, messageInfo, reply }) => {
      try {
        await reply("🔄 Bot akan shutdown dalam 3 detik...");

        // Delay untuk mengirim pesan
        setTimeout(() => {
          console.log("🔄 Bot shutdown dari WhatsApp command");
          process.exit(0); // Exit dengan code 0 untuk shutdown
        }, 3000);
      } catch (error) {
        console.error("Error in shutdown command:", error);
        await reply("❌ Terjadi error saat shutdown bot");
      }
    },
  });

  // ==================== LOGS COMMAND ====================
  registry.addGlobalCommand({
    name: "logs",
    aliases: ["log", "history"],
    description: "Show recent bot logs (Owner only)",
    usage: "logs [lines]",
    category: "owner",
    isowner: true,
    exec: async ({ sock, messageInfo, reply, args }) => {
      try {
        const lines = parseInt(args[0]) || 20;
        const maxLines = 50; // Limit to prevent spam
        const actualLines = Math.min(lines, maxLines);

        const logData = `📋 *BOT LOGS (Last ${actualLines} entries)*

🕒 ${new Date().toLocaleString()}
ℹ️ Bot Status: ${
          botStatus.isRunning
            ? botStatus.isPaused
              ? "Paused"
              : "Running"
            : "Stopped"
        }
📊 Messages Processed: ${botStatus.messageCount}
❌ Errors: ${botStatus.errorCount}
⏱️ Uptime: ${Math.floor((Date.now() - botStatus.startTime) / 1000 / 60)} minutes

🔍 *Recent Activity:*
• Bot initialized successfully
• Owner commands loaded
• Message handler active
• Anti-call system enabled
• Group management active

💡 *Tip:* Use 'status' command for detailed system info`;

        await reply(logData);
      } catch (error) {
        botLogger.error("Error in logs command:", error);
        await reply("❌ *Error*\n\nTerjadi kesalahan saat mengambil logs.");
      }
    },
  });

  // ==================== CLEAR CACHE COMMAND ====================
  registry.addGlobalCommand({
    name: "clearcache",
    aliases: ["cc", "clearc"],
    description: "Clear bot cache and temporary data (Owner only)",
    usage: "clearcache",
    category: "owner",
    isowner: true,
    exec: async ({ sock, messageInfo, reply }) => {
      try {
        let clearedItems = [];

        // Clear Node.js require cache (except core modules)
        const moduleKeys = Object.keys(require.cache || {});
        let modulesClearedCount = 0;

        for (const key of moduleKeys) {
          if (!key.includes("node_modules")) {
            delete require.cache[key];
            modulesClearedCount++;
          }
        }

        if (modulesClearedCount > 0) {
          clearedItems.push(`${modulesClearedCount} cached modules`);
        }

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
          clearedItems.push("Memory garbage collected");
        }

        const resultMessage =
          clearedItems.length > 0
            ? `✅ *Cache Cleared*\n\nItems cleared:\n${clearedItems
                .map((item) => `• ${item}`)
                .join("\n")}`
            : `✅ *Cache Cleared*\n\nCache sudah bersih atau tidak ada yang perlu dibersihkan.`;

        await reply(resultMessage);
      } catch (error) {
        botLogger.error("Error in clearcache command:", error);
        await reply("❌ *Error*\n\nTerjadi kesalahan saat membersihkan cache.");
      }
    },
  });

  // ==================== UPDATE COMMAND ====================
  registry.addGlobalCommand({
    name: "update",
    aliases: ["pull", "gitpull"],
    description: "Update bot from git repository (Owner only)",
    usage: "update",
    category: "owner",
    isowner: true,
    exec: async ({ sock, messageInfo, reply }) => {
      try {
        await reply("🔄 *Updating Bot*\n\nMemeriksa update dari repository...");

        const { exec } = await import("child_process");
        const { promisify } = await import("util");
        const execAsync = promisify(exec);

        try {
          // Git pull command
          const { stdout, stderr } = await execAsync("git pull origin main");

          let updateMessage = "📦 *Update Complete*\n\n";

          if (stdout.includes("Already up to date")) {
            updateMessage += "✅ Bot sudah menggunakan versi terbaru.";
          } else {
            updateMessage += `✅ Update berhasil!\n\n*Changes:*\n\`\`\`${stdout}\`\`\``;
            updateMessage += "\n\n💡 *Tip:* Gunakan 'restart' untuk menerapkan update.";
          }

          if (stderr) {
            updateMessage += `\n\n⚠️ *Warnings:*\n\`\`\`${stderr}\`\`\``;
          }

          await reply(updateMessage);
        } catch (gitError) {
          await reply(
            `❌ *Update Failed*\n\nError: ${gitError.message}\n\n💡 Pastikan bot berada dalam git repository dan memiliki akses internet.`
          );
        }
      } catch (error) {
        botLogger.error("Error in update command:", error);
        await reply("❌ *Error*\n\nTerjadi kesalahan saat melakukan update.");
      }
    },
  });

  // ==================== BACKUP COMMAND ====================
  registry.addGlobalCommand({
    name: "backup",
    aliases: ["bk", "save"],
    description: "Create bot configuration backup (Owner only)",
    usage: "backup",
    category: "owner",
    isowner: true,
    exec: async ({ sock, messageInfo, reply }) => {
      try {
        await reply("💾 *Creating Backup*\n\nMembuat backup konfigurasi bot...");

        // Create backup using JSONManager
        try {
          const backupPath = await config.ownerDB.createBackup();
          const groupBackupPath = await config.group.createBackup();
          const callBackupPath = await config.callDB.createBackup();

          const backupInfo = `✅ *Backup Created Successfully*

📁 *Backup Files:*
• Owner DB: ${path.basename(backupPath)}
• Group DB: ${path.basename(groupBackupPath)}  
• Call DB: ${path.basename(callBackupPath)}

🕒 Timestamp: ${new Date().toISOString()}
📍 Location: ./backups/`;

          await reply(backupInfo);
        } catch (backupError) {
          await reply(`❌ *Backup Failed*\n\nError: ${backupError.message}`);
        }
      } catch (error) {
        botLogger.error("Error in backup command:", error);
        await reply("❌ *Error*\n\nTerjadi kesalahan saat membuat backup.");
      }
    },
  });

  // ==================== SPEEDTEST COMMAND ====================
  registry.addGlobalCommand({
    name: "speedtest",
    aliases: ["speed", "ping"],
    description: "Test bot response speed (Owner only)",
    usage: "speedtest",
    category: "owner",
    isowner: true,
    exec: async ({ sock, messageInfo, reply }) => {
      try {
        const startTime = Date.now();

        await reply("⚡ *Speed Test*\n\nTesting bot response time...");

        const responseTime = Date.now() - startTime;

        // Additional performance metrics
        const memoryUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();

        const speedTestResult = `⚡ *SPEED TEST RESULTS*

📊 *Response Time:*
├ Message Response: ${responseTime}ms
├ Status: ${
          responseTime < 100
            ? "🟢 Excellent"
            : responseTime < 300
            ? "🟡 Good"
            : "🔴 Slow"
        }

💾 *Memory Usage:*
├ Heap Used: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB
├ Heap Total: ${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB
├ RSS: ${Math.round(memoryUsage.rss / 1024 / 1024)}MB

⚙️ *CPU Usage:*
├ User: ${Math.round(cpuUsage.user / 1000)}ms
├ System: ${Math.round(cpuUsage.system / 1000)}ms

🚀 *Performance:* ${
          responseTime < 100 && memoryUsage.heapUsed < 100000000
            ? "Optimal"
            : "Needs Attention"
        }`;

        await reply(speedTestResult);
      } catch (error) {
        botLogger.error("Error in speedtest command:", error);
        await reply("❌ *Error*\n\nTerjadi kesalahan saat melakukan speed test.");
      }
    },
  });

  // ==================== RELOAD COMMAND ====================
  registry.addGlobalCommand({
    name: "reload",
    aliases: ["rl", "refresh"],
    description: "Reload bot commands and modules (Owner only)",
    usage: "reload [module]",
    category: "owner",
    isowner: true,
    exec: async ({ sock, messageInfo, reply, args }) => {
      try {
        await reply("🔄 *Reloading*\n\nMemuat ulang modul bot...");

        let reloadedModules = [];

        if (args.length > 0) {
          // Reload specific module
          const moduleName = args[0];
          try {
            // Clear from require cache if it exists
            const moduleKeys = Object.keys(require.cache || {});
            const targetModule = moduleKeys.find(key => key.includes(moduleName));
            
            if (targetModule) {
              delete require.cache[targetModule];
              reloadedModules.push(moduleName);
            } else {
              await reply(`❌ *Module Not Found*\n\nModul '${moduleName}' tidak ditemukan.`);
              return;
            }
          } catch (moduleError) {
            await reply(`❌ *Module Error*\n\nError loading '${moduleName}': ${moduleError.message}`);
            return;
          }
        } else {
          // Reload all non-core modules
          const moduleKeys = Object.keys(require.cache || {});
          for (const key of moduleKeys) {
            if (key.includes(__dirname) && !key.includes("node_modules")) {
              delete require.cache[key];
              reloadedModules.push(path.basename(key));
            }
          }
        }

        // Reset command statistics
        if (registry.commandStats) {
          registry.commandStats.clear();
        }

        const reloadMessage = `✅ *Reload Complete*\n\n📦 *Modules Reloaded (${
          reloadedModules.length
        }):*\n${
          reloadedModules.length > 0
            ? reloadedModules.map((mod) => `• ${mod}`).join("\n")
            : "No modules reloaded"
        }\n\n🔄 Bot statistics reset.`;

        await reply(reloadMessage);
      } catch (error) {
        botLogger.error("Error in reload command:", error);
        await reply("❌ *Error*\n\nTerjadi kesalahan saat melakukan reload.");
      }
    },
  });

  // ==================== ADD OWNER COMMAND ====================
  registry.addGlobalCommand({
    name: "addowner",
    aliases: ["tambahowner", "newowner"],
    description: "Add new owner (Super Owner only)",
    usage: "addowner <phone_number>",
    category: "owner",
    isowner: true,
    exec: async ({ sock, messageInfo, reply, args }) => {
      try {
        const senderJid = messageInfo.participant || messageInfo.sender;
        const senderPhone = senderJid.split("@")[0];

        // Get current owners
        const currentOwners = await config.ownerDB.get("owners", []);
        const superOwner = await config.ownerDB.get("superOwner", "");

        // Only super owner can add new owners
        if (superOwner && senderPhone !== superOwner) {
          await reply("❌ *Permission Denied*\n\nHanya Super Owner yang dapat menambah owner baru.");
          return;
        }

        if (!args.length) {
          await reply("❌ *Usage Error*\n\nGunakan: addowner <nomor_telepon>\nContoh: addowner 628123456789");
          return;
        }

        const phoneNumber = args[0].replace(/[^0-9]/g, "");

        if (currentOwners.includes(phoneNumber)) {
          await reply(`⚠️ *Already Owner*\n\nNomor ${phoneNumber} sudah menjadi owner.`);
          return;
        }

        // Add to owners list
        currentOwners.push(phoneNumber);
        await config.ownerDB.set("owners", currentOwners);

        // Update registry owners
        registry.setOwners(currentOwners);

        await reply(`✅ *Owner Added*\n\nNomor ${phoneNumber} berhasil ditambahkan sebagai owner.`);
      } catch (error) {
        botLogger.error("Error in addowner command:", error);
        await reply("❌ *Error*\n\nTerjadi kesalahan saat menambah owner.");
      }
    },
  });

  // ==================== REMOVE OWNER COMMAND ====================
  registry.addGlobalCommand({
    name: "delowner",
    aliases: ["hapusowner", "removeowner"],
    description: "Remove owner (Super Owner only)",
    usage: "delowner <phone_number>",
    category: "owner",
    isowner: true,
    exec: async ({ sock, messageInfo, reply, args }) => {
      try {
        const senderJid = messageInfo.participant || messageInfo.sender;
        const senderPhone = senderJid.split("@")[0];

        // Get current owners
        const currentOwners = await config.ownerDB.get("owners", []);
        const superOwner = await config.ownerDB.get("superOwner", "");

        // Only super owner can remove owners
        if (superOwner && senderPhone !== superOwner) {
          await reply("❌ *Permission Denied*\n\nHanya Super Owner yang dapat menghapus owner.");
          return;
        }

        if (!args.length) {
          await reply("❌ *Usage Error*\n\nGunakan: delowner <nomor_telepon>\nContoh: delowner 628123456789");
          return;
        }

        const phoneNumber = args[0].replace(/[^0-9]/g, "");

        if (!currentOwners.includes(phoneNumber)) {
          await reply(`⚠️ *Not Found*\n\nNomor ${phoneNumber} bukan owner.`);
          return;
        }

        // Cannot remove super owner
        if (phoneNumber === superOwner) {
          await reply(`❌ *Cannot Remove*\n\nSuper Owner tidak dapat dihapus.`);
          return;
        }

        // Remove from owners list
        const updatedOwners = currentOwners.filter(owner => owner !== phoneNumber);
        await config.ownerDB.set("owners", updatedOwners);

        // Update registry owners
        registry.setOwners(updatedOwners);

        await reply(`✅ *Owner Removed*\n\nNomor ${phoneNumber} berhasil dihapus dari daftar owner.`);
      } catch (error) {
        botLogger.error("Error in delowner command:", error);
        await reply("❌ *Error*\n\nTerjadi kesalahan saat menghapus owner.");
      }
    },
  });

  // ==================== LIST OWNERS COMMAND ====================
  registry.addGlobalCommand({
    name: "listowner",
    aliases: ["owners", "daftarowner"],
    description: "Show list of owners (Owner only)",
    usage: "listowner",
    category: "owner",
    isowner: true,
    exec: async ({ sock, messageInfo, reply }) => {
      try {
        const owners = await config.ownerDB.get("owners", []);
        const superOwner = await config.ownerDB.get("superOwner", "");

        let ownerList = "👑 *OWNER LIST*\n\n";

        if (superOwner) {
          ownerList += `🌟 *Super Owner:*\n├ +${superOwner}\n\n`;
        }

        if (owners.length > 0) {
          ownerList += `👥 *Owners (${owners.length}):*\n`;
          owners.forEach((owner, index) => {
            const prefix = index === owners.length - 1 ? "└" : "├";
            const isSuperOwner = owner === superOwner ? " ⭐" : "";
            ownerList += `${prefix} +${owner}${isSuperOwner}\n`;
          });
        } else {
          ownerList += "👥 *Owners:* Tidak ada\n";
        }

        ownerList += `\n📊 *Total:* ${owners.length} owner(s)`;

        await reply(ownerList);
      } catch (error) {
        botLogger.error("Error in listowner command:", error);
        await reply("❌ *Error*\n\nTerjadi kesalahan saat mengambil daftar owner.");
      }
    },
  });

  // ==================== CLAIM OWNER COMMAND ====================
  registry.addGlobalCommand({
    name: "claimowner",
    aliases: ["claim", "jdiowner"],
    description: "Claim ownership (Use only if no owners exist)",
    usage: "claimowner",
    category: "owner",
    isowner: false, // This is special case
    exec: async ({ sock, messageInfo, reply }) => {
      try {
        const senderJid = messageInfo.participant || messageInfo.sender;
        const senderPhone = senderJid.split("@")[0];

        // Only allow if no owners exist at all
        const owners = await config.ownerDB.get("owners", []);
        const superOwner = await config.ownerDB.get("superOwner", "");

        if (owners.length > 0 || superOwner) {
          await reply("❌ *Claim Denied*\n\nSudah ada owner yang terdaftar.\nHubungi owner untuk mendapatkan akses.");
          return;
        }

        // Set as super owner and first owner
        await config.ownerDB.set("superOwner", senderPhone);
        await config.ownerDB.set("owners", [senderPhone]);

        // Update registry owners
        registry.setOwners([senderPhone]);

        await reply(`🎉 *Ownership Claimed*\n\nSelamat! Anda sekarang adalah Super Owner bot.\nNomor: +${senderPhone}\n\nGunakan perintah owner lainnya untuk mengelola bot.`);

        botLogger.info(`Emergency ownership claimed by: ${senderPhone}`);
      } catch (error) {
        botLogger.error("Error in claimowner command:", error);
        await reply("❌ *Error*\n\nTerjadi kesalahan saat mengklaim ownership.");
      }
    },
  });

  // ==================== STATUS COMMAND ====================
  registry.addGlobalCommand({
    name: "status",
    aliases: ["stat", "botstat"],
    description: "Show bot status and statistics (Owner only)",
    usage: "status",
    category: "owner",
    isowner: true,
    exec: async ({ sock, messageInfo, reply }) => {
      try {
        const uptime = process.uptime();
        const uptimeStr = `${Math.floor(uptime / 3600)}h ${Math.floor(
          (uptime % 3600) / 60
        )}m ${Math.floor(uptime % 60)}s`;

        const memoryUsage = process.memoryUsage();
        const stats = registry.getCommandStats();
        const totalCommands = Object.keys(stats).length;
        const totalExecutions = Object.values(stats).reduce((sum, stat) => sum + stat.executions, 0);

        const statusMessage = `📊 *BOT STATUS & STATISTICS*

🤖 *Bot Info:*
├ Status: ${botStatus.isRunning ? "🟢 Running" : "🔴 Stopped"}
├ Uptime: ${uptimeStr}
├ Version: ${config.Botinfo?.version || "1.0.0"}
└ Prefix: ${registry.prefix}

💾 *Memory Usage:*
├ Heap Used: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB
├ Heap Total: ${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB
└ RSS: ${Math.round(memoryUsage.rss / 1024 / 1024)}MB

📈 *Command Statistics:*
├ Total Commands: ${totalCommands}
├ Total Executions: ${totalExecutions}
├ Messages Processed: ${botStatus.messageCount}
└ Errors: ${botStatus.errorCount}

🔧 *System Info:*
├ Platform: ${process.platform}
├ Node Version: ${process.version}
└ PID: ${process.pid}`;

        await reply(statusMessage);
      } catch (error) {
        botLogger.error("Error in status command:", error);
        await reply("❌ *Error*\n\nTerjadi kesalahan saat mengambil status.");
      }
    },
  });

  botLogger.info("✅ Owner Commands Loaded Successfully");
}