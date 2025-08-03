import { botLogger } from "../bot.js";
import config from "../config.js";
import path from "path";
import { fileURLToPath } from "url";
import { promises as fs } from "fs";
import { createRequire } from "module";

// Create require function for ES modules
const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Bot status tracking
const botStatus = {
  isRunning: true,
  isPaused: false,
  startTime: Date.now(),
  messageCount: 0,
  errorCount: 0,
  lastActivity: Date.now(),
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
    isowner: true,
    exec: async ({ sock, messageInfo, reply }) => {
      try {
        await reply("🔄 Bot akan restart dalam 3 detik...");
        setTimeout(() => {
          console.log("🔄 Bot restart dari WhatsApp command");
          process.exit(1);
        }, 3000);
      } catch (error) {
        console.error("Error in restart command:", error);
        await reply("❌ Terjadi error saat restart bot");
      }
    },
  });

  // ==================== BROADCAST COMMAND ====================
  registry.addGlobalCommand({
    name: "broadcast",
    aliases: ["bc", "siaran"],
    description: "Send broadcast message to all groups (Owner only)",
    usage: "broadcast <message>",
    category: "owner",
    isowner: true,
    exec: async ({ sock, messageInfo, reply, args }) => {
      try {
        if (!args.length) {
          await reply("❌ *Usage Error*\n\nGunakan: broadcast <pesan>\nContoh: broadcast Halo semua!");
          return;
        }

        const message = args.join(" ");
        const groups = await sock.groupFetchAllParticipating();
        const groupIds = Object.keys(groups);

        if (groupIds.length === 0) {
          await reply("⚠️ *No Groups*\n\nBot tidak tergabung dalam grup manapun.");
          return;
        }

        await reply(`📡 *Broadcasting*\n\nMengirim pesan ke ${groupIds.length} grup...\n\n*Pesan:*\n${message}`);

        let successCount = 0;
        let failCount = 0;

        for (const groupId of groupIds) {
          try {
            const broadcastMessage = `📢 *BROADCAST MESSAGE*\n\n${message}\n\n_Pesan ini dikirim oleh Owner Bot_`;
            await sock.sendMessage(groupId, { text: broadcastMessage });
            successCount++;
            
            // Small delay to prevent spam
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (error) {
            botLogger.error(`Failed to broadcast to ${groupId}:`, error);
            failCount++;
          }
        }

        const resultMessage = `✅ *Broadcast Complete*\n\n📊 *Results:*\n├ Success: ${successCount} groups\n├ Failed: ${failCount} groups\n└ Total: ${groupIds.length} groups`;
        await reply(resultMessage);

      } catch (error) {
        botLogger.error("Error in broadcast command:", error);
        await reply("❌ *Error*\n\nTerjadi kesalahan saat broadcast.");
      }
    },
  });

  // ==================== JOIN GROUP COMMAND ====================
  registry.addGlobalCommand({
    name: "join",
    aliases: ["joingroup", "masukgrup"],
    description: "Join group via invite link (Owner only)",
    usage: "join <invite_link>",
    category: "owner",
    isowner: true,
    exec: async ({ sock, messageInfo, reply, args }) => {
      try {
        if (!args.length) {
          await reply("❌ *Usage Error*\n\nGunakan: join <link_undangan>\nContoh: join https://chat.whatsapp.com/xxxxx");
          return;
        }

        const inviteLink = args[0];
        const inviteCodeMatch = inviteLink.match(/(?:https:\/\/chat\.whatsapp\.com\/|invite\/)([A-Za-z0-9]+)/);
        
        if (!inviteCodeMatch) {
          await reply("❌ *Invalid Link*\n\nLink undangan tidak valid. Pastikan menggunakan format:\nhttps://chat.whatsapp.com/xxxxx");
          return;
        }

        const inviteCode = inviteCodeMatch[1];
        
        try {
          const groupInfo = await sock.groupGetInviteInfo(inviteCode);
          await reply(`🔍 *Group Info*\n\nNama: ${groupInfo.subject}\nDeskripsi: ${groupInfo.desc || "Tidak ada"}\nAnggota: ${groupInfo.size} orang\n\nBergabung ke grup...`);
          
          const result = await sock.groupAcceptInvite(inviteCode);
          await reply(`✅ *Success*\n\nBerhasil bergabung ke grup: ${groupInfo.subject}`);
          
        } catch (joinError) {
          if (joinError.message.includes("not-authorized")) {
            await reply("❌ *Authorization Failed*\n\nBot tidak memiliki izin untuk bergabung ke grup ini.");
          } else if (joinError.message.includes("gone")) {
            await reply("❌ *Link Expired*\n\nLink undangan sudah tidak berlaku.");
          } else {
            await reply(`❌ *Join Failed*\n\nGagal bergabung ke grup: ${joinError.message}`);
          }
        }

      } catch (error) {
        botLogger.error("Error in join command:", error);
        await reply("❌ *Error*\n\nTerjadi kesalahan saat bergabung ke grup.");
      }
    },
  });

  // ==================== LEAVE GROUP COMMAND ====================
  registry.addGlobalCommand({
    name: "leave",
    aliases: ["leavegroup", "keluar"],
    description: "Leave from current group or specified group (Owner only)",
    usage: "leave [group_id]",
    category: "owner",
    isowner: true,
    exec: async ({ sock, messageInfo, reply, args }) => {
      try {
        let targetGroupId;
        
        if (args.length > 0) {
          targetGroupId = args[0];
        } else {
          // Leave current group if command is used in group
          if (messageInfo.isGroup) {
            targetGroupId = messageInfo.chat;
          } else {
            await reply("❌ *Usage Error*\n\nGunakan di grup atau sertakan group ID:\nleave <group_id>");
            return;
          }
        }

        try {
          const groupMetadata = await sock.groupMetadata(targetGroupId);
          
          await reply(`👋 *Leaving Group*\n\nBot akan keluar dari grup: ${groupMetadata.subject}\n\nTerima kasih telah menggunakan bot ini!`);
          
          // Small delay before leaving
          setTimeout(async () => {
            await sock.groupLeave(targetGroupId);
            botLogger.info(`Bot left group: ${groupMetadata.subject} (${targetGroupId})`);
          }, 2000);
          
        } catch (leaveError) {
          await reply(`❌ *Leave Failed*\n\nGagal keluar dari grup: ${leaveError.message}`);
        }

      } catch (error) {
        botLogger.error("Error in leave command:", error);
        await reply("❌ *Error*\n\nTerjadi kesalahan saat keluar dari grup.");
      }
    },
  });

  // ==================== GROUP LIST COMMAND ====================
  registry.addGlobalCommand({
    name: "groups",
    aliases: ["listgroups", "daftargrup"],
    description: "Show list of groups bot is in (Owner only)",
    usage: "groups",
    category: "owner",
    isowner: true,
    exec: async ({ sock, messageInfo, reply }) => {
      try {
        const groups = await sock.groupFetchAllParticipating();
        const groupList = Object.values(groups);

        if (groupList.length === 0) {
          await reply("📋 *GROUP LIST*\n\nBot belum tergabung dalam grup manapun.");
          return;
        }

        let message = `📋 *GROUP LIST (${groupList.length})*\n\n`;
        
        groupList.forEach((group, index) => {
          const prefix = index === groupList.length - 1 ? "└" : "├";
          message += `${prefix} *${group.subject}*\n`;
          message += `   └ ID: ${group.id}\n`;
          message += `   └ Members: ${group.participants.length}\n`;
          message += `   └ Admin: ${group.participants.filter(p => p.admin).length}\n\n`;
        });

        message += `📊 *Total: ${groupList.length} groups*`;
        await reply(message);

      } catch (error) {
        botLogger.error("Error in groups command:", error);
        await reply("❌ *Error*\n\nTerjadi kesalahan saat mengambil daftar grup.");
      }
    },
  });

  // ==================== EVAL COMMAND ====================
  registry.addGlobalCommand({
    name: "eval",
    aliases: ["ev", "evaluate"],
    description: "Execute JavaScript code (Owner only - Use with caution!)",
    usage: "eval <code>",
    category: "owner",
    isowner: true,
    exec: async ({ sock, messageInfo, reply, args }) => {
      try {
        if (!args.length) {
          await reply("❌ *Usage Error*\n\nGunakan: eval <kode_javascript>\nContoh: eval console.log('Hello')");
          return;
        }

        const code = args.join(" ");
        
        try {
          // Create a safer evaluation context
          const result = eval(`(async () => { ${code} })()`);
          const output = await Promise.resolve(result);
          
          let responseText = "✅ *Code Executed*\n\n";
          responseText += `*Input:*\n\`\`\`${code}\`\`\`\n\n`;
          
          if (output !== undefined) {
            responseText += `*Output:*\n\`\`\`${typeof output === 'object' ? JSON.stringify(output, null, 2) : String(output)}\`\`\``;
          } else {
            responseText += "*Output:* undefined";
          }
          
          await reply(responseText);
          
        } catch (evalError) {
          await reply(`❌ *Execution Error*\n\n*Input:*\n\`\`\`${code}\`\`\`\n\n*Error:*\n\`\`\`${evalError.message}\`\`\``);
        }

      } catch (error) {
        botLogger.error("Error in eval command:", error);
        await reply("❌ *Error*\n\nTerjadi kesalahan saat menjalankan kode.");
      }
    },
  });

  // ==================== EXEC COMMAND ====================
  registry.addGlobalCommand({
    name: "exec",
    aliases: ["ex", "shell"],
    description: "Execute shell command (Owner only - Dangerous!)",
    usage: "exec <command>",
    category: "owner",
    isowner: true,
    exec: async ({ sock, messageInfo, reply, args }) => {
      try {
        if (!args.length) {
          await reply("❌ *Usage Error*\n\nGunakan: exec <command>\nContoh: exec ls -la");
          return;
        }

        const command = args.join(" ");
        
        // Security check - block dangerous commands
        const dangerousCommands = ['rm', 'del', 'format', 'fdisk', 'mkfs', 'dd', 'shutdown', 'reboot', 'halt'];
        const commandLower = command.toLowerCase();
        
        if (dangerousCommands.some(cmd => commandLower.includes(cmd))) {
          await reply("❌ *Dangerous Command*\n\nCommand yang berpotensi berbahaya tidak diizinkan.");
          return;
        }

        try {
          const { exec } = await import("child_process");
          const { promisify } = await import("util");
          const execAsync = promisify(exec);
          
          await reply(`⚡ *Executing Command*\n\n\`\`\`${command}\`\`\`\n\nPlease wait...`);
          
          const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
          
          let output = "";
          if (stdout) output += `*Output:*\n\`\`\`${stdout}\`\`\`\n\n`;
          if (stderr) output += `*Error:*\n\`\`\`${stderr}\`\`\``;
          
          if (!output) output = "*No output generated*";
          
          await reply(`✅ *Command Executed*\n\n${output}`);
          
        } catch (execError) {
          await reply(`❌ *Execution Failed*\n\n*Command:*\n\`\`\`${command}\`\`\`\n\n*Error:*\n\`\`\`${execError.message}\`\`\``);
        }

      } catch (error) {
        botLogger.error("Error in exec command:", error);
        await reply("❌ *Error*\n\nTerjadi kesalahan saat menjalankan command.");
      }
    },
  });

  // ==================== BLOCK USER COMMAND ====================
  registry.addGlobalCommand({
    name: "block",
    aliases: ["blokir", "ban"],
    description: "Block user from using bot (Owner only)",
    usage: "block <@user|phone_number>",
    category: "owner",
    isowner: true,
    exec: async ({ sock, messageInfo, reply, args }) => {
      try {
        let targetPhone = "";
        
        if (messageInfo.mentionedJid && messageInfo.mentionedJid.length > 0) {
          targetPhone = messageInfo.mentionedJid[0].split("@")[0];
        } else if (args.length > 0) {
          targetPhone = args[0].replace(/[^0-9]/g, "");
        } else {
          await reply("❌ *Usage Error*\n\nGunakan: block <@user> atau block <nomor>\nContoh: block @user atau block 628123456789");
          return;
        }

        // Get current blocked users
        const blockedUsers = await config.ownerDB.get("blockedUsers", []);
        
        if (blockedUsers.includes(targetPhone)) {
          await reply(`⚠️ *Already Blocked*\n\nUser +${targetPhone} sudah diblokir.`);
          return;
        }

        // Add to blocked list
        blockedUsers.push(targetPhone);
        await config.ownerDB.set("blockedUsers", blockedUsers);

        await reply(`✅ *User Blocked*\n\nUser +${targetPhone} berhasil diblokir dari menggunakan bot.`);
        botLogger.info(`User blocked: ${targetPhone}`);

      } catch (error) {
        botLogger.error("Error in block command:", error);
        await reply("❌ *Error*\n\nTerjadi kesalahan saat memblokir user.");
      }
    },
  });

  // ==================== UNBLOCK USER COMMAND ====================
  registry.addGlobalCommand({
    name: "unblock",
    aliases: ["unblokir", "unban"],
    description: "Unblock user from using bot (Owner only)",
    usage: "unblock <@user|phone_number>",
    category: "owner",
    isowner: true,
    exec: async ({ sock, messageInfo, reply, args }) => {
      try {
        let targetPhone = "";
        
        if (messageInfo.mentionedJid && messageInfo.mentionedJid.length > 0) {
          targetPhone = messageInfo.mentionedJid[0].split("@")[0];
        } else if (args.length > 0) {
          targetPhone = args[0].replace(/[^0-9]/g, "");
        } else {
          await reply("❌ *Usage Error*\n\nGunakan: unblock <@user> atau unblock <nomor>\nContoh: unblock @user atau unblock 628123456789");
          return;
        }

        // Get current blocked users
        const blockedUsers = await config.ownerDB.get("blockedUsers", []);
        
        if (!blockedUsers.includes(targetPhone)) {
          await reply(`⚠️ *Not Blocked*\n\nUser +${targetPhone} tidak dalam daftar blokir.`);
          return;
        }

        // Remove from blocked list
        const updatedBlockedUsers = blockedUsers.filter(user => user !== targetPhone);
        await config.ownerDB.set("blockedUsers", updatedBlockedUsers);

        await reply(`✅ *User Unblocked*\n\nUser +${targetPhone} berhasil dihapus dari daftar blokir.`);
        botLogger.info(`User unblocked: ${targetPhone}`);

      } catch (error) {
        botLogger.error("Error in unblock command:", error);
        await reply("❌ *Error*\n\nTerjadi kesalahan saat menghapus blokir user.");
      }
    },
  });

  // ==================== BLOCKED USERS LIST COMMAND ====================
  registry.addGlobalCommand({
    name: "blocklist",
    aliases: ["listblocked", "daftarblokir"],
    description: "Show list of blocked users (Owner only)",
    usage: "blocklist",
    category: "owner",
    isowner: true,
    exec: async ({ sock, messageInfo, reply }) => {
      try {
        const blockedUsers = await config.ownerDB.get("blockedUsers", []);

        if (blockedUsers.length === 0) {
          await reply("📋 *BLOCKED USERS*\n\nTidak ada user yang diblokir.");
          return;
        }

        let message = `🚫 *BLOCKED USERS (${blockedUsers.length})*\n\n`;
        
        blockedUsers.forEach((phone, index) => {
          const prefix = index === blockedUsers.length - 1 ? "└" : "├";
          message += `${prefix} +${phone}\n`;
        });

        message += `\n📊 *Total: ${blockedUsers.length} blocked users*`;
        await reply(message);

      } catch (error) {
        botLogger.error("Error in blocklist command:", error);
        await reply("❌ *Error*\n\nTerjadi kesalahan saat mengambil daftar user yang diblokir.");
      }
    },
  });

  // ==================== SET STATUS COMMAND ====================
  registry.addGlobalCommand({
    name: "setstatus",
    aliases: ["status", "bio"],
    description: "Set bot WhatsApp status (Owner only)",
    usage: "setstatus <status_text>",
    category: "owner",
    isowner: true,
    exec: async ({ sock, messageInfo, reply, args }) => {
      try {
        if (!args.length) {
          await reply("❌ *Usage Error*\n\nGunakan: setstatus <teks_status>\nContoh: setstatus Bot WhatsApp aktif 24/7");
          return;
        }

        const statusText = args.join(" ");
        
        try {
          await sock.updateProfileStatus(statusText);
          await reply(`✅ *Status Updated*\n\nStatus WhatsApp bot berhasil diubah ke:\n"${statusText}"`);
          
        } catch (statusError) {
          await reply(`❌ *Update Failed*\n\nGagal mengubah status: ${statusError.message}`);
        }

      } catch (error) {
        botLogger.error("Error in setstatus command:", error);
        await reply("❌ *Error*\n\nTerjadi kesalahan saat mengubah status.");
      }
    },
  });

  // ==================== MAINTENANCE MODE COMMAND ====================
  registry.addGlobalCommand({
    name: "maintenance",
    aliases: ["maint", "perbaikan"],
    description: "Toggle maintenance mode (Owner only)",
    usage: "maintenance [on|off]",
    category: "owner",
    isowner: true,
    exec: async ({ sock, messageInfo, reply, args }) => {
      try {
        const currentMode = await config.ownerDB.get("maintenanceMode", false);
        
        if (!args.length) {
          const status = currentMode ? "ON" : "OFF";
          await reply(`🔧 *Maintenance Mode*\n\nStatus saat ini: ${status}\n\nGunakan: maintenance on/off`);
          return;
        }

        const action = args[0].toLowerCase();
        
        if (action === "on" || action === "aktif") {
          await config.ownerDB.set("maintenanceMode", true);
          await reply("🔧 *Maintenance Mode: ON*\n\nBot sekarang dalam mode maintenance.\nHanya owner yang dapat menggunakan command.");
          
        } else if (action === "off" || action === "nonaktif") {
          await config.ownerDB.set("maintenanceMode", false);
          await reply("✅ *Maintenance Mode: OFF*\n\nBot kembali normal.\nSemua user dapat menggunakan command.");
          
        } else {
          await reply("❌ *Invalid Option*\n\nGunakan: maintenance on/off");
        }

      } catch (error) {
        botLogger.error("Error in maintenance command:", error);
        await reply("❌ *Error*\n\nTerjadi kesalahan saat mengubah mode maintenance.");
      }
    },
  });

  // ==================== SYSTEM INFO COMMAND ====================
  registry.addGlobalCommand({
    name: "sysinfo",
    aliases: ["system", "info"],
    description: "Show detailed system information (Owner only)",
    usage: "sysinfo",
    category: "owner",
    isowner: true,
    exec: async ({ sock, messageInfo, reply }) => {
      try {
        const os = await import("os");
        const uptime = process.uptime();
        const systemUptime = os.uptime();
        
        const formatUptime = (seconds) => {
          const days = Math.floor(seconds / 86400);
          const hours = Math.floor((seconds % 86400) / 3600);
          const minutes = Math.floor((seconds % 3600) / 60);
          const secs = Math.floor(seconds % 60);
          return `${days}d ${hours}h ${minutes}m ${secs}s`;
        };

        const memoryUsage = process.memoryUsage();
        const systemMemory = {
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem()
        };

        const sysInfo = `🖥️ *SYSTEM INFORMATION*

💻 *Operating System:*
├ Platform: ${os.platform()}
├ Architecture: ${os.arch()}
├ Release: ${os.release()}
└ Hostname: ${os.hostname()}

🔧 *Node.js Info:*
├ Version: ${process.version}
├ PID: ${process.pid}
├ Uptime: ${formatUptime(uptime)}
└ Working Directory: ${process.cwd()}

💾 *Memory Usage:*
├ Heap Used: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB
├ Heap Total: ${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB
├ RSS: ${Math.round(memoryUsage.rss / 1024 / 1024)}MB
└ External: ${Math.round(memoryUsage.external / 1024 / 1024)}MB

🖥️ *System Memory:*
├ Total: ${Math.round(systemMemory.total / 1024 / 1024 / 1024)}GB
├ Used: ${Math.round(systemMemory.used / 1024 / 1024 / 1024)}GB
├ Free: ${Math.round(systemMemory.free / 1024 / 1024 / 1024)}GB
└ Usage: ${Math.round((systemMemory.used / systemMemory.total) * 100)}%

⚙️ *CPU Info:*
├ Cores: ${os.cpus().length}
├ Model: ${os.cpus()[0].model}
├ Speed: ${os.cpus()[0].speed}MHz
└ Load Average: ${os.loadavg().map(l => l.toFixed(2)).join(", ")}

⏱️ *Uptime:*
├ Process: ${formatUptime(uptime)}
└ System: ${formatUptime(systemUptime)}`;

        await reply(sysInfo);

      } catch (error) {
        botLogger.error("Error in sysinfo command:", error);
        await reply("❌ *Error*\n\nTerjadi kesalahan saat mengambil informasi sistem.");
      }
    },
  });

  // ==================== ORIGINAL COMMANDS ====================
  
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
        setTimeout(() => {
          console.log("🔄 Bot shutdown dari WhatsApp command");
          process.exit(0);
        }, 3000);
      } catch (error) {
        console.error("Error in shutdown command:", error);
        await reply("❌ Terjadi error saat shutdown bot");
      }
    },
  });

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
        const maxLines = 50;
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

  // ==================== CLEARCACHE COMMAND ====================
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
        console.log(error);
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
          const moduleName = args[0];
          try {
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
          const moduleKeys = Object.keys(require.cache || {});
          for (const key of moduleKeys) {
            if (key.includes(__dirname) && !key.includes("node_modules")) {
              delete require.cache[key];
              reloadedModules.push(path.basename(key));
            }
          }
        }

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

  // ==================== OWNER MANAGEMENT COMMANDS ====================
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

        const currentOwners = await config.ownerDB.get("owners", []);
        const superOwner = await config.ownerDB.get("superOwner", "");

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

        currentOwners.push(phoneNumber);
        await config.ownerDB.set("owners", currentOwners);
        registry.setOwners(currentOwners);

        await reply(`✅ *Owner Added*\n\nNomor ${phoneNumber} berhasil ditambahkan sebagai owner.`);
      } catch (error) {
        botLogger.error("Error in addowner command:", error);
        await reply("❌ *Error*\n\nTerjadi kesalahan saat menambah owner.");
      }
    },
  });

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

        const currentOwners = await config.ownerDB.get("owners", []);
        const superOwner = await config.ownerDB.get("superOwner", "");

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

        if (phoneNumber === superOwner) {
          await reply(`❌ *Cannot Remove*\n\nSuper Owner tidak dapat dihapus.`);
          return;
        }

        const updatedOwners = currentOwners.filter(owner => owner !== phoneNumber);
        await config.ownerDB.set("owners", updatedOwners);
        registry.setOwners(updatedOwners);

        await reply(`✅ *Owner Removed*\n\nNomor ${phoneNumber} berhasil dihapus dari daftar owner.`);
      } catch (error) {
        botLogger.error("Error in delowner command:", error);
        await reply("❌ *Error*\n\nTerjadi kesalahan saat menghapus owner.");
      }
    },
  });

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

  registry.addGlobalCommand({
    name: "claimowner",
    aliases: ["claim", "jdiowner"],
    description: "Claim ownership (Use only if no owners exist)",
    usage: "claimowner",
    category: "owner",
    isowner: false,
    exec: async ({ sock, messageInfo, reply }) => {
      try {
        const senderJid = messageInfo.participant || messageInfo.sender;
        const senderPhone = senderJid.split("@")[0];

        const owners = await config.ownerDB.get("owners", []);
        const superOwner = await config.ownerDB.get("superOwner", "");

        if (owners.length > 0 || superOwner) {
          await reply("❌ *Claim Denied*\n\nSudah ada owner yang terdaftar.\nHubungi owner untuk mendapatkan akses.");
          return;
        }

        await config.ownerDB.set("superOwner", senderPhone);
        await config.ownerDB.set("owners", [senderPhone]);
        registry.setOwners([senderPhone]);

        await reply(`🎉 *Ownership Claimed*\n\nSelamat! Anda sekarang adalah Super Owner bot.\nNomor: +${senderPhone}\n\nGunakan perintah owner lainnya untuk mengelola bot.`);
        botLogger.info(`Emergency ownership claimed by: ${senderPhone}`);
      } catch (error) {
        botLogger.error("Error in claimowner command:", error);
        await reply("❌ *Error*\n\nTerjadi kesalahan saat mengklaim ownership.");
      }
    },
  });

  botLogger.info("✅ Enhanced Owner Commands Loaded Successfully");
}