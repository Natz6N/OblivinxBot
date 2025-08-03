import config from "../config.js";

function normalizeGroupId(groupId) {
  if (!groupId) return "";

  // Jika sudah lengkap dengan @g.us, return as is
  if (groupId.endsWith("@g.us")) {
    return groupId;
  }

  // Jika hanya berakhir dengan @g, tambahkan .us
  if (groupId.endsWith("@g")) {
    return groupId + ".us";
  }

  // Jika tidak ada @g sama sekali, tambahkan @g.us
  if (!groupId.includes("@")) {
    return groupId + "@g.us";
  }

  return groupId;
}

function normalizeJid(jid) {
  return jid.replace(/[^0-9]/g, "");
}

export default function (registry) {
  // 1. Enhanced Anti-Link Command
  registry.addGlobalCommand({
    name: "antilink",
    aliases: ["antilinkgroup", "linkprotect"],
    description:
      "Mengatur proteksi anti-link dengan whitelist dan pengecualian",
    usage: "/antilink <on/off/config> [options]",
    category: "security",
    exec: async ({ sock, args, messageInfo, reply }) => {
      const { sender, raw } = messageInfo;
      const groupId = raw.key.remoteJid;
      const safeGroupId = groupId.replace(/\./g, "__");

      // Ambil konfigurasi antilink dengan beberapa cara fallback
      let antilinkConfig = config.group.get(`${safeGroupId}.security.antilink`);

      // Jika gagal, coba akses manual
      if (!antilinkConfig) {
        const groupData = config.group.get(safeGroupId);
        if (groupData?.security?.antilink) {
          antilinkConfig = groupData.security.antilink;
        }
      }

      // Periksa apakah konfigurasi sudah diinisialisasi
      if (!antilinkConfig) {
        console.error(`Antilink config not found for group: ${groupId}`);
        return reply(
          "❌ Konfigurasi antilink belum diinisialisasi untuk grup ini!\n" +
            "Silakan restart bot atau hubungi administrator."
        );
      }

      if (!messageInfo.isGroup) {
        return reply("❌ Perintah ini hanya bisa digunakan di grup!");
      }

      if (!messageInfo.isAdmin) {
        return reply("❌ Hanya admin yang bisa mengatur anti-link!");
      }

      const action = args[0]?.toLowerCase();

      if (!action || !["on", "off", "status", "config"].includes(action)) {
        return await sock.sendMessage(sender, {
          text:
            `📋 *Antilink Management*\n\n` +
            `Penggunaan:\n` +
            `• ${registry.prefix}antilink on - Aktifkan antilink\n` +
            `• ${registry.prefix}antilink off - Nonaktifkan antilink\n` +
            `• ${registry.prefix}antilink status - Lihat status\n` +
            `• ${registry.prefix}antilink config - Lihat konfigurasi\n\n` +
            `Status saat ini: ${
              antilinkConfig.status ? "✅ Aktif" : "❌ Nonaktif"
            }`,
        });
      }

      switch (action) {
        case "on":
          if (antilinkConfig.status) {
            return await sock.sendMessage(sender, {
              text: "ℹ️ Fitur antilink sudah aktif!",
            });
          }

          // Aktifkan antilink
          antilinkConfig.status = true;
          await config.group.set(
            `${safeGroupId}.security.antilink`,
            antilinkConfig
          );

          // Update statistik
          const currentStats =
            config.group.get(`${safeGroupId}.statistics`) || {};
          await config.group.set(`${safeGroupId}.statistics`, {
            ...currentStats,
            last_updated: new Date().toISOString(),
          });

          return await sock.sendMessage(sender, {
            text:
              `✅ *Antilink Diaktifkan!*\n\n` +
              `🔗 Domain yang diblokir: ${antilinkConfig.link_blocked.length} domain\n` +
              `⚡ Aksi: ${antilinkConfig.action}\n` +
              `👮‍♂️ Whitelist admin: ${
                antilinkConfig.whitelist_admins ? "Ya" : "Tidak"
              }\n` +
              `⚠️ Auto kick setelah: ${antilinkConfig.auto_kick_after} pelanggaran\n\n` +
              `Link yang terdeteksi akan otomatis dihapus dengan pesan peringatan.`,
          });

        case "off":
          if (!antilinkConfig.status) {
            return await sock.sendMessage(sender, {
              text: "ℹ️ Fitur antilink sudah nonaktif!",
            });
          }

          // Nonaktifkan antilink
          antilinkConfig.status = false;
          await config.group.set(
            `${safeGroupId}.security.antilink`,
            antilinkConfig
          );

          return await sock.sendMessage(sender, {
            text:
              `❌ *Antilink Dinonaktifkan!*\n\n` +
              `Link sekarang diperbolehkan di grup ini.`,
          });

        case "status":
          const violations = Object.keys(
            antilinkConfig.violations || {}
          ).length;
          const totalViolations =
            config.group.get(
              `${safeGroupId}.statistics.violation_breakdown.antilink`
            ) || 0;

          return await sock.sendMessage(sender, {
            text:
              `📊 *Status Antilink*\n\n` +
              `🔘 Status: ${
                antilinkConfig.status ? "✅ Aktif" : "❌ Nonaktif"
              }\n` +
              `🔗 Domain diblokir: ${antilinkConfig.link_blocked.length}\n` +
              `✅ Domain dikecualikan: ${antilinkConfig.exceptions.length}\n` +
              `👮‍♂️ Whitelist admin: ${
                antilinkConfig.whitelist_admins ? "Ya" : "Tidak"
              }\n` +
              `⚡ Aksi: ${antilinkConfig.action}\n` +
              `🚫 Auto kick: ${antilinkConfig.auto_kick_after} pelanggaran\n` +
              `📈 Total pelanggaran: ${totalViolations}\n` +
              `👥 User dengan pelanggaran: ${violations}\n\n` +
              `💬 Pesan peringatan:\n"${antilinkConfig.warning_message}"`,
          });

        case "config":
          return await sock.sendMessage(sender, {
            text:
              `⚙️ *Konfigurasi Antilink*\n\n` +
              `🔗 *Domain Diblokir:*\n${antilinkConfig.link_blocked
                .map((d) => `• ${d}`)
                .join("\n")}\n\n` +
              `✅ *Domain Dikecualikan:*\n${antilinkConfig.exceptions
                .map((d) => `• ${d}`)
                .join("\n")}\n\n` +
              `⚙️ *Pengaturan:*\n` +
              `• Aksi: ${antilinkConfig.action}\n` +
              `• Auto kick: ${antilinkConfig.auto_kick_after} pelanggaran\n` +
              `• Whitelist admin: ${
                antilinkConfig.whitelist_admins ? "Ya" : "Tidak"
              }\n\n` +
              `Gunakan command terpisah untuk mengubah konfigurasi.`,
          });

        default:
          return await sock.sendMessage(messageInfo.sender, {
            text: "❌ Aksi tidak valid! Gunakan: on, off, status, atau config",
          });
      }
    },
  });

  // 2. Anti-Spam Command
  registry.addGlobalCommand({
    name: "antispam",
    aliases: ["spamprotect"],
    description: "Mengatur proteksi anti-spam pesan berulang",
    usage: "/antispam <on/off/config>",
    category: "security",
    exec: async ({ args, messageInfo, reply }) => {
      if (!messageInfo.isGroup) {
        return reply("❌ Perintah ini hanya bisa digunakan di grup!");
      }

      if (!messageInfo.isAdmin) {
        return reply("❌ Hanya admin yang bisa mengatur anti-spam!");
      }

      const groupId = messageInfo.raw.key.remoteJid;
      const safeGroupId = groupId.replace(/\./g, "__");

      let currentSettings = config.group.get(
        `${safeGroupId}.security.antispam`
      );

      if (args.length === 0) {
        let info = `🚫 *PENGATURAN ANTI-SPAM*\n\n`;
        info += `Status: ${
          currentSettings.status ? "✅ Aktif" : "❌ Nonaktif"
        }\n`;
        info += `Max Pesan Sama: ${currentSettings.max_same_message}\n`;
        info += `Time Window: ${currentSettings.time_window} detik\n`;
        info += `Action: ${currentSettings.action}\n`;
        info += `Durasi Mute: ${currentSettings.mute_duration} detik\n`;
        info += `Whitelist Admin: ${
          currentSettings.whitelist_admins ? "Ya" : "Tidak"
        }\n\n`;
        info += `📝 *Commands:*\n`;
        info += `• /antispam on/off\n`;
        info += `• /antispam config max <angka>\n`;
        info += `• /antispam config time <detik>\n`;
        info += `• /antispam config action <mute/delete/warn/kick>`;

        return reply(info);
      }

      switch (args[0].toLowerCase()) {
        case "on":
          currentSettings.status = true;
          await config.group.set(
            `${safeGroupId}.security.antispam`,
            currentSettings
          );
          reply("✅ Anti-spam diaktifkan!");
          break;

        case "off":
          currentSettings.status = false;
          await config.group.set(
            `${safeGroupId}.security.antispam`,
            currentSettings
          );
          reply("✅ Anti-spam dimatikan!");
          break;

        case "config":
          if (args[1] === "max" && args[2]) {
            const maxMsg = parseInt(args[2]);
            if (maxMsg > 0 && maxMsg <= 20) {
              currentSettings.max_same_message = maxMsg;
              await config.group.set(
                `${safeGroupId}.security.antispam`,
                currentSettings
              );
              reply(`✅ Max pesan sama diatur ke: ${maxMsg}`);
            } else {
              reply("❌ Jumlah harus antara 1-20");
            }
          } else if (args[1] === "time" && args[2]) {
            const time = parseInt(args[2]);
            if (time >= 10 && time <= 600) {
              currentSettings.time_window = time;
              await config.group.set(
                `${safeGroupId}.security.antispam`,
                currentSettings
              );
              reply(`✅ Time window diatur ke: ${time} detik`);
            } else {
              reply("❌ Waktu harus antara 10-600 detik");
            }
          } else if (args[1] === "action" && args[2]) {
            const validActions = ["mute", "delete", "warn", "kick"];
            if (validActions.includes(args[2])) {
              currentSettings.action = args[2];
              await config.group.set(
                `${safeGroupId}.security.antispam`,
                currentSettings
              );
              reply(`✅ Action anti-spam diubah ke: ${args[2]}`);
            } else {
              reply("❌ Action valid: mute, delete, warn, kick");
            }
          }
          break;

        default:
          reply("❌ Gunakan: on/off/config");
      }
    },
  });

  // 3. Anti-Flood Command
  registry.addGlobalCommand({
    name: "antiflood",
    aliases: ["floodprotect"],
    description: "Mengatur proteksi anti-flood (pesan terlalu cepat)",
    usage: "/antiflood <on/off/config>",
    category: "security",
    exec: async ({ args, messageInfo, reply }) => {
      if (!messageInfo.isGroup) {
        return reply("❌ Perintah ini hanya bisa digunakan di grup!");
      }

      if (!messageInfo.isAdmin) {
        return reply("❌ Hanya admin yang bisa mengatur anti-flood!");
      }

      const groupId = messageInfo.raw.key.remoteJid;
      const safeGroupId = groupId.replace(/\./g, "__");
      let currentSettings = config.group.get(
        `${safeGroupId}.security.antiflood`
      );

      if (args.length === 0) {
        let info = `⚡ *PENGATURAN ANTI-FLOOD*\n\n`;
        info += `Status: ${
          currentSettings.status ? "✅ Aktif" : "❌ Nonaktif"
        }\n`;
        info += `Max Pesan: ${currentSettings.max_messages}\n`;
        info += `Time Window: ${currentSettings.time_window} detik\n`;
        info += `Action: ${currentSettings.action}\n`;
        info += `Durasi Mute: ${currentSettings.mute_duration} detik\n`;
        info += `Progressive Mute: ${
          currentSettings.progressive_mute ? "Ya" : "Tidak"
        }\n`;
        info += `Max Violations: ${currentSettings.max_violations}\n\n`;
        info += `📝 *Commands:*\n`;
        info += `• /antiflood on/off\n`;
        info += `• /antiflood config max <angka>\n`;
        info += `• /antiflood config time <detik>\n`;
        info += `• /antiflood config violations <angka>`;

        return reply(info);
      }

      switch (args[0].toLowerCase()) {
        case "on":
          currentSettings.status = true;
          await config.group.set(
            `${safeGroupId}.security.antiflood`,
            currentSettings
          );
          reply("✅ Anti-flood diaktifkan!");
          break;

        case "off":
          currentSettings.status = false;
          await config.group.set(
            `${safeGroupId}.security.antiflood`,
            currentSettings
          );
          reply("✅ Anti-flood dimatikan!");
          break;

        case "config":
          if (args[1] === "max" && args[2]) {
            const maxMsg = parseInt(args[2]);
            if (maxMsg > 0 && maxMsg <= 50) {
              currentSettings.max_messages = maxMsg;
              await config.group.set(
                `${safeGroupId}.security.antiflood`,
                currentSettings
              );
              reply(`✅ Max pesan diatur ke: ${maxMsg}`);
            } else {
              reply("❌ Jumlah harus antara 1-50");
            }
          } else if (args[1] === "time" && args[2]) {
            const time = parseInt(args[2]);
            if (time >= 5 && time <= 120) {
              currentSettings.time_window = time;
              await config.group.set(
                `${safeGroupId}.security.antiflood`,
                currentSettings
              );
              reply(`✅ Time window diatur ke: ${time} detik`);
            } else {
              reply("❌ Waktu harus antara 5-120 detik");
            }
          } else if (args[1] === "violations" && args[2]) {
            const violations = parseInt(args[2]);
            if (violations >= 1 && violations <= 10) {
              currentSettings.max_violations = violations;
              await config.group.set(
                `${safeGroupId}.security.antiflood`,
                currentSettings
              );
              reply(`✅ Max violations diatur ke: ${violations}`);
            } else {
              reply("❌ Violations harus antara 1-10");
            }
          }
          break;

        default:
          reply("❌ Gunakan: on/off/config");
      }
    },
  });

  // 4. Anti-Tag All Command
  registry.addGlobalCommand({
    name: "antitagall",
    aliases: ["tagprotect"],
    description: "Mengatur proteksi anti-tag berlebihan",
    usage: "/antitagall <on/off/config>",
    category: "security",
    exec: async ({ args, messageInfo, reply }) => {
      if (!messageInfo.isGroup) {
        return reply("❌ Perintah ini hanya bisa digunakan di grup!");
      }

      if (!messageInfo.isAdmin) {
        return reply("❌ Hanya admin yang bisa mengatur anti-tag all!");
      }

      const groupId = messageInfo.raw.key.remoteJid;
      const safeGroupId = groupId.replace(/\./g, "__");
      let currentSettings = config.group.get(
        `${safeGroupId}.security.antitagall`
      );

      if (args.length === 0) {
        let info = `👥 *PENGATURAN ANTI-TAG ALL*\n\n`;
        info += `Status: ${
          currentSettings.status ? "✅ Aktif" : "❌ Nonaktif"
        }\n`;
        info += `Max Mentions: ${currentSettings.max_mentions}\n`;
        info += `Action: ${currentSettings.action}\n`;
        info += `Allow Reply Mentions: ${
          currentSettings.allow_reply_mentions ? "Ya" : "Tidak"
        }\n`;
        info += `Whitelist Users: ${currentSettings.whitelist_users.length}\n\n`;
        info += `📝 *Commands:*\n`;
        info += `• /antitagall on/off\n`;
        info += `• /antitagall config max <angka>\n`;
        info += `• /antitagall whitelist <add/remove> <@user>`;

        return reply(info);
      }

      switch (args[0].toLowerCase()) {
        case "on":
          currentSettings.status = true;
          await config.group.set(
            `${safeGroupId}.security.antitagall`,
            currentSettings
          );
          reply("✅ Anti-tag all diaktifkan!");
          break;

        case "off":
          currentSettings.status = false;
          await config.group.set(
            `${safeGroupId}.security.antitagall`,
            currentSettings
          );
          reply("✅ Anti-tag all dimatikan!");
          break;

        case "config":
          if (args[1] === "max" && args[2]) {
            const maxMentions = parseInt(args[2]);
            if (maxMentions > 0 && maxMentions <= 20) {
              currentSettings.max_mentions = maxMentions;
              await config.group.set(
                `${safeGroupId}.security.antitagall`,
                currentSettings
              );
              reply(`✅ Max mentions diatur ke: ${maxMentions}`);
            } else {
              reply("❌ Jumlah harus antara 1-20");
            }
          }
          break;

        case "whitelist":
          if (
            args[1] === "add" &&
            messageInfo.mentionedJid &&
            messageInfo.mentionedJid.length > 0
          ) {
            const userJid = messageInfo.mentionedJid[0];
            if (!currentSettings.whitelist_users.includes(userJid)) {
              currentSettings.whitelist_users.push(userJid);
              await config.group.set(
                `${safeGroupId}.security.antitagall`,
                currentSettings
              );
              reply(`✅ @${userJid.split("@")[0]} ditambahkan ke whitelist`, {
                mentions: [userJid],
              });
            } else {
              reply("❌ User sudah ada di whitelist");
            }
          } else if (
            args[1] === "remove" &&
            messageInfo.mentionedJid &&
            messageInfo.mentionedJid.length > 0
          ) {
            const userJid = messageInfo.mentionedJid[0];
            const index = currentSettings.whitelist_users.indexOf(userJid);
            if (index > -1) {
              currentSettings.whitelist_users.splice(index, 1);
              await config.group.set(
                `${safeGroupId}.security.antitagall`,
                currentSettings
              );
              reply(`✅ @${userJid.split("@")[0]} dihapus dari whitelist`, {
                mentions: [userJid],
              });
            } else {
              reply("❌ User tidak ditemukan di whitelist");
            }
          }
          break;

        default:
          reply("❌ Gunakan: on/off/config/whitelist");
      }
    },
  });

  // 5. Anti-Delete Command
  registry.addGlobalCommand({
    name: "antidelete",
    aliases: ["antidel", "deleteprotect"],
    description: "Mengatur proteksi anti-delete message",
    usage: "/antidelete <on/off/config>",
    category: "security",
    exec: async ({ args, messageInfo, reply }) => {
      if (!messageInfo.isGroup) {
        return reply("❌ Perintah ini hanya bisa digunakan di grup!");
      }

      if (!messageInfo.isAdmin) {
        return reply("❌ Hanya admin yang bisa mengatur anti-delete!");
      }

      const groupId = messageInfo.raw.key.remoteJid;
      const safeGroupId = groupId.replace(/\./g, "__");
      let currentSettings = config.group.get(
        `${safeGroupId}.security.antidelete`
      );

      if (args.length === 0) {
        let info = `🗑️ *PENGATURAN ANTI-DELETE*\n\n`;
        info += `Status: ${
          currentSettings.status ? "✅ Aktif" : "❌ Nonaktif"
        }\n`;
        info += `Store Messages: ${
          currentSettings.store_deleted_messages ? "Ya" : "Tidak"
        }\n`;
        info += `Forward to Admins: ${
          currentSettings.forward_to_admins ? "Ya" : "Tidak"
        }\n`;
        info += `Show in Group: ${
          currentSettings.show_in_group ? "Ya" : "Tidak"
        }\n`;
        info += `Max Stored: ${currentSettings.max_stored_messages}\n`;
        info += `Ignore Admins: ${
          currentSettings.ignore_admins ? "Ya" : "Tidak"
        }\n`;
        info += `Auto Cleanup: ${currentSettings.auto_cleanup_days} hari\n\n`;
        info += `📝 *Commands:*\n`;
        info += `• /antidelete on/off\n`;
        info += `• /antidelete config show <on/off>\n`;
        info += `• /antidelete config forward <on/off>\n`;
        info += `• /antidelete config max <angka>`;

        return reply(info);
      }

      switch (args[0].toLowerCase()) {
        case "on":
          currentSettings.status = true;
          await config.group.set(
            `${safeGroupId}.security.antidelete`,
            currentSettings
          );
          reply("✅ Anti-delete diaktifkan!");
          break;

        case "off":
          currentSettings.status = false;
          await config.group.set(
            `${safeGroupId}.security.antidelete`,
            currentSettings
          );
          reply("✅ Anti-delete dimatikan!");
          break;

        case "config":
          if (args[1] === "show" && args[2]) {
            const showValue = args[2].toLowerCase() === "on";
            currentSettings.show_in_group = showValue;
            await config.group.set(
              `${safeGroupId}.security.antidelete`,
              currentSettings
            );
            reply(
              `✅ Show in group: ${showValue ? "Diaktifkan" : "Dimatikan"}`
            );
          } else if (args[1] === "forward" && args[2]) {
            const forwardValue = args[2].toLowerCase() === "on";
            currentSettings.forward_to_admins = forwardValue;
            await config.group.set(
              `${safeGroupId}.security.antidelete`,
              currentSettings
            );
            reply(
              `✅ Forward to admins: ${
                forwardValue ? "Diaktifkan" : "Dimatikan"
              }`
            );
          } else if (args[1] === "max" && args[2]) {
            const maxStored = parseInt(args[2]);
            if (maxStored >= 10 && maxStored <= 500) {
              currentSettings.max_stored_messages = maxStored;
              await config.group.set(
                `${safeGroupId}.security.antidelete`,
                currentSettings
              );
              reply(`✅ Max stored messages: ${maxStored}`);
            } else {
              reply("❌ Jumlah harus antara 10-500");
            }
          }
          break;

        default:
          reply("❌ Gunakan: on/off/config");
      }
    },
  });

  // 6. Word Filter Command
  registry.addGlobalCommand({
    name: "wordfilter",
    aliases: ["filter", "badword"],
    description: "Mengatur filter kata dan frasa tertentu",
    usage: "/wordfilter <on/off/add/remove/list>",
    category: "security",
    exec: async ({ args, messageInfo, reply }) => {
      if (!messageInfo.isGroup) {
        return reply("❌ Perintah ini hanya bisa digunakan di grup!");
      }

      if (!messageInfo.isAdmin) {
        return reply("❌ Hanya admin yang bisa mengatur word filter!");
      }

      const groupId = messageInfo.raw.key.remoteJid;
      const safeGroupId = groupId.replace(/\./g, "__");
      let currentSettings = config.group.get(
        `${safeGroupId}.security.wordfilter`
      );

      if (args.length === 0) {
        let info = `🔤 *PENGATURAN WORD FILTER*\n\n`;
        info += `Status: ${
          currentSettings.status ? "✅ Aktif" : "❌ Nonaktif"
        }\n`;
        info += `Action: ${currentSettings.action}\n`;
        info += `Case Sensitive: ${
          currentSettings.case_sensitive ? "Ya" : "Tidak"
        }\n`;
        info += `Auto Replace: ${
          currentSettings.auto_replace ? "Ya" : "Tidak"
        }\n\n`;
        info += `📝 *Commands:*\n`;
        info += `• /wordfilter on/off\n`;
        info += `• /wordfilter add <kata>\n`;
        info += `• /wordfilter remove <kata>\n`;
        info += `• /wordfilter phrase add <frasa>\n`;
        info += `• /wordfilter list`;

        return reply(info);
      }

      switch (args[0].toLowerCase()) {
        case "on":
          currentSettings.status = true;
          await config.group.set(
            `${safeGroupId}.security.wordfilter`,
            currentSettings
          );
          reply("✅ Word filter diaktifkan!");
          break;

        case "off":
          currentSettings.status = false;
          await config.group.set(
            `${safeGroupId}.security.wordfilter`,
            currentSettings
          );
          reply("✅ Word filter dimatikan!");
          break;

        case "add":
          if (args[1]) {
            const word = args.slice(1).join(" ").toLowerCase();
            if (!currentSettings.blocked_words.includes(word)) {
              currentSettings.blocked_words.push(word);
              await config.group.set(
                `${safeGroupId}.security.wordfilter`,
                currentSettings
              );
              reply(`✅ Kata "${word}" ditambahkan ke filter`);
            } else {
              reply("❌ Kata sudah ada di filter");
            }
          }
          break;

        case "remove":
          if (args[1]) {
            const word = args.slice(1).join(" ").toLowerCase();
            const index = currentSettings.blocked_words.indexOf(word);
            if (index > -1) {
              currentSettings.blocked_words.splice(index, 1);
              await config.group.set(
                `${safeGroupId}.security.wordfilter`,
                currentSettings
              );
              reply(`✅ Kata "${word}" dihapus dari filter`);
            } else {
              reply("❌ Kata tidak ditemukan di filter");
            }
          }
          break;

        case "phrase":
          if (args[1] === "add" && args[2]) {
            const phrase = args.slice(2).join(" ").toLowerCase();
            if (!currentSettings.blocked_phrases.includes(phrase)) {
              currentSettings.blocked_phrases.push(phrase);
              await config.group.set(
                `${safeGroupId}.security.wordfilter`,
                currentSettings
              );
              reply(`✅ Frasa "${phrase}" ditambahkan ke filter`);
            } else {
              reply("❌ Frasa sudah ada di filter");
            }
          } else if (args[1] === "remove" && args[2]) {
            const phrase = args.slice(2).join(" ").toLowerCase();
            const index = currentSettings.blocked_phrases.indexOf(phrase);
            if (index > -1) {
              currentSettings.blocked_phrases.splice(index, 1);
              await config.group.set(
                `${safeGroupId}.security.wordfilter`,
                currentSettings
              );
              reply(`✅ Frasa "${phrase}" dihapus dari filter`);
            } else {
              reply("❌ Frasa tidak ditemukan di filter");
            }
          }
          break;

        case "list":
          let listMsg = `📋 *DAFTAR FILTER*\n\n`;
          listMsg += `🔤 *Kata (${currentSettings.blocked_words.length}):*\n`;
          listMsg += currentSettings.blocked_words.join(", ") || "Tidak ada";
          listMsg += `\n\n💬 *Frasa (${currentSettings.blocked_phrases.length}):*\n`;
          listMsg += currentSettings.blocked_phrases.join(", ") || "Tidak ada";
          reply(listMsg);
          break;

        default:
          reply("❌ Gunakan: on/off/add/remove/phrase/list");
      }
    },
  });

  // 7. Night Mode Command
  registry.addGlobalCommand({
    name: "nightmode",
    aliases: ["night", "malam"],
    description: "Mengatur mode malam grup",
    usage: "/nightmode <on/off/config>",
    category: "security",
    exec: async ({ args, messageInfo, reply }) => {
      if (!messageInfo.isGroup) {
        return reply("❌ Perintah ini hanya bisa digunakan di grup!");
      }

      if (!messageInfo.isAdmin) {
        return reply("❌ Hanya admin yang bisa mengatur night mode!");
      }

      const groupId = messageInfo.raw.key.remoteJid;
      const safeGroupId = groupId.replace(/\./g, "__");
      let currentSettings = config.group.get(
        `${safeGroupId}.security.nightmode`
      );

      if (args.length === 0) {
        let info = `🌙 *PENGATURAN NIGHT MODE*\n\n`;
        info += `Status: ${
          currentSettings.status ? "✅ Aktif" : "❌ Nonaktif"
        }\n`;
        info += `Waktu: ${currentSettings.start_time} - ${currentSettings.end_time}\n`;
        info += `Timezone: ${currentSettings.timezone}\n`;
        info += `Mute Non-Admin: ${
          currentSettings.mute_non_admins ? "Ya" : "Tidak"
        }\n`;
        info += `Weekend Mode: ${
          currentSettings.weekend_mode ? "Ya" : "Tidak"
        }\n\n`;
        info += `📝 *Commands:*\n`;
        info += `• /nightmode on/off\n`;
        info += `• /nightmode config time <start> <end>\n`;
        info += `• /nightmode config weekend <on/off>`;

        return reply(info);
      }

      switch (args[0].toLowerCase()) {
        case "on":
          currentSettings.status = true;
          await config.group.set(
            `${safeGroupId}.security.nightmode`,
            currentSettings
          );
          reply("✅ Night mode diaktifkan!");
          break;

        case "off":
          currentSettings.status = false;
          await config.group.set(
            `${safeGroupId}.security.nightmode`,
            currentSettings
          );
          reply("✅ Night mode dimatikan!");
          break;

        case "config":
          if (args[1] === "time" && args[2] && args[3]) {
            const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
            if (timeRegex.test(args[2]) && timeRegex.test(args[3])) {
              currentSettings.start_time = args[2];
              currentSettings.end_time = args[3];
              await config.group.set(
                `${safeGroupId}.security.nightmode`,
                currentSettings
              );
              reply(`✅ Waktu night mode: ${args[2]} - ${args[3]}`);
            } else {
              reply("❌ Format waktu salah! Gunakan HH:MM (contoh: 22:00)");
            }
          } else if (args[1] === "weekend" && args[2]) {
            const weekendValue = args[2].toLowerCase() === "on";
            currentSettings.weekend_mode = weekendValue;
            await config.group.set(
              `${safeGroupId}.security.nightmode`,
              currentSettings
            );
            reply(
              `✅ Weekend mode: ${weekendValue ? "Diaktifkan" : "Dimatikan"}`
            );
          }
          break;

        default:
          reply("❌ Gunakan: on/off/config");
      }
    },
  });

  // 8. Anti View Once Command
  registry.addGlobalCommand({
    name: "antiviewonce",
    aliases: ["antiview", "viewprotect"],
    description: "Mengatur proteksi anti-view once message",
    usage: "/antiviewonce <on/off/config>",
    category: "security",
    exec: async ({ args, messageInfo, reply }) => {
      if (!messageInfo.isGroup) {
        return reply("❌ Perintah ini hanya bisa digunakan di grup!");
      }

      if (!messageInfo.isAdmin) {
        return reply("❌ Hanya admin yang bisa mengatur anti-view once!");
      }

      const groupId = messageInfo.raw.key.remoteJid;
      const safeGroupId = groupId.replace(/\./g, "__");
      let currentSettings = config.group.get(
        `${safeGroupId}.security.antiviewonce`
      );

      if (args.length === 0) {
        let info = `👁️ *PENGATURAN ANTI-VIEW ONCE*\n\n`;
        info += `Status: ${
          currentSettings.status ? "✅ Aktif" : "❌ Nonaktif"
        }\n`;
        info += `Save View Once: ${
          currentSettings.save_viewonce ? "Ya" : "Tidak"
        }\n`;
        info += `Forward to Admins: ${
          currentSettings.forward_to_admins ? "Ya" : "Tidak"
        }\n`;
        info += `Show in Group: ${
          currentSettings.show_in_group ? "Ya" : "Tidak"
        }\n`;
        info += `Storage Limit: ${currentSettings.storage_limit}\n`;
        info += `Auto Cleanup: ${currentSettings.auto_cleanup_days} hari\n\n`;
        info += `📝 *Commands:*\n`;
        info += `• /antiviewonce on/off\n`;
        info += `• /antiviewonce config save <on/off>\n`;
        info += `• /antiviewonce config forward <on/off>\n`;
        info += `• /antiviewonce config limit <angka>`;

        return reply(info);
      }

      switch (args[0].toLowerCase()) {
        case "on":
          currentSettings.status = true;
          await config.group.set(
            `${safeGroupId}.security.antiviewonce`,
            currentSettings
          );
          reply("✅ Anti-view once diaktifkan!");
          break;

        case "off":
          currentSettings.status = false;
          await config.group.set(
            `${safeGroupId}.security.antiviewonce`,
            currentSettings
          );
          reply("✅ Anti-view once dimatikan!");
          break;

        case "config":
          if (args[1] === "save" && args[2]) {
            const saveValue = args[2].toLowerCase() === "on";
            currentSettings.save_viewonce = saveValue;
            await config.group.set(
              `${safeGroupId}.security.antiviewonce`,
              currentSettings
            );
            reply(
              `✅ Save view once: ${saveValue ? "Diaktifkan" : "Dimatikan"}`
            );
          } else if (args[1] === "forward" && args[2]) {
            const forwardValue = args[2].toLowerCase() === "on";
            currentSettings.forward_to_admins = forwardValue;
            await config.group.set(
              `${safeGroupId}.security.antiviewonce`,
              currentSettings
            );
            reply(
              `✅ Forward to admins: ${
                forwardValue ? "Diaktifkan" : "Dimatikan"
              }`
            );
          } else if (args[1] === "limit" && args[2]) {
            const limit = parseInt(args[2]);
            if (limit >= 10 && limit <= 200) {
              currentSettings.storage_limit = limit;
              await config.group.set(
                `${safeGroupId}.security.antiviewonce`,
                currentSettings
              );
              reply(`✅ Storage limit: ${limit}`);
            } else {
              reply("❌ Limit harus antara 10-200");
            }
          }
          break;

        default:
          reply("❌ Gunakan: on/off/config");
      }
    },
  });

  // 9. Anti Sticker Command
  registry.addGlobalCommand({
    name: "antisticker",
    aliases: ["stickerprotect"],
    description: "Mengatur proteksi anti-sticker spam",
    usage: "/antisticker <on/off/config>",
    category: "security",
    exec: async ({ args, messageInfo, reply }) => {
      if (!messageInfo.isGroup) {
        return reply("❌ Perintah ini hanya bisa digunakan di grup!");
      }

      if (!messageInfo.isAdmin) {
        return reply("❌ Hanya admin yang bisa mengatur anti-sticker!");
      }

      const groupId = messageInfo.raw.key.remoteJid;
      const safeGroupId = groupId.replace(/\./g, "__");
      let currentSettings = config.group.get(
        `${safeGroupId}.security.antisticker`
      );

      if (args.length === 0) {
        let info = `🎭 *PENGATURAN ANTI-STICKER*\n\n`;
        info += `Status: ${
          currentSettings.status ? "✅ Aktif" : "❌ Nonaktif"
        }\n`;
        info += `Max Stickers: ${currentSettings.max_stickers}\n`;
        info += `Time Window: ${currentSettings.time_window} detik\n`;
        info += `Action: ${currentSettings.action}\n`;
        info += `Mute Duration: ${currentSettings.mute_duration} detik\n\n`;
        info += `📝 *Commands:*\n`;
        info += `• /antisticker on/off\n`;
        info += `• /antisticker config max <angka>\n`;
        info += `• /antisticker config time <detik>`;

        return reply(info);
      }

      switch (args[0].toLowerCase()) {
        case "on":
          currentSettings.status = true;
          await config.group.set(
            `${safeGroupId}.security.antisticker`,
            currentSettings
          );
          reply("✅ Anti-sticker diaktifkan!");
          break;

        case "off":
          currentSettings.status = false;
          await config.group.set(
            `${safeGroupId}.security.antisticker`,
            currentSettings
          );
          reply("✅ Anti-sticker dimatikan!");
          break;

        case "config":
          if (args[1] === "max" && args[2]) {
            const maxStickers = parseInt(args[2]);
            if (maxStickers > 0 && maxStickers <= 20) {
              currentSettings.max_stickers = maxStickers;
              await config.group.set(
                `${safeGroupId}.security.antisticker`,
                currentSettings
              );
              reply(`✅ Max stickers: ${maxStickers}`);
            } else {
              reply("❌ Jumlah harus antara 1-20");
            }
          } else if (args[1] === "time" && args[2]) {
            const time = parseInt(args[2]);
            if (time >= 10 && time <= 300) {
              currentSettings.time_window = time;
              await config.group.set(
                `${safeGroupId}.security.antisticker`,
                currentSettings
              );
              reply(`✅ Time window: ${time} detik`);
            } else {
              reply("❌ Waktu harus antara 10-300 detik");
            }
          }
          break;

        default:
          reply("❌ Gunakan: on/off/config");
      }
    },
  });

  // 10. Anti Media Command
  registry.addGlobalCommand({
    name: "antimedia",
    aliases: ["mediaprotect"],
    description: "Mengatur proteksi anti-media spam",
    usage: "/antimedia <on/off/config>",
    category: "security",
    exec: async ({ args, messageInfo, reply }) => {
      if (!messageInfo.isGroup) {
        return reply("❌ Perintah ini hanya bisa digunakan di grup!");
      }

      if (!messageInfo.isAdmin) {
        return reply("❌ Hanya admin yang bisa mengatur anti-media!");
      }

      const groupId = messageInfo.raw.key.remoteJid;
      const safeGroupId = groupId.replace(/\./g, "__");
      let currentSettings = config.group.get(
        `${safeGroupId}.security.antimedia`
      );

      if (args.length === 0) {
        let info = `📎 *PENGATURAN ANTI-MEDIA*\n\n`;
        info += `Status: ${
          currentSettings.status ? "✅ Aktif" : "❌ Nonaktif"
        }\n`;
        info += `Max Media: ${currentSettings.max_media}\n`;
        info += `Time Window: ${currentSettings.time_window} detik\n`;
        info += `Max File Size: ${Math.round(
          currentSettings.max_file_size / 1048576
        )}MB\n`;
        info += `Blocked Types: ${currentSettings.blocked_types.join(
          ", "
        )}\n\n`;
        info += `📝 *Commands:*\n`;
        info += `• /antimedia on/off\n`;
        info += `• /antimedia config max <angka>\n`;
        info += `• /antimedia config size <MB>\n`;
        info += `• /antimedia block <add/remove> <type>`;

        return reply(info);
      }

      switch (args[0].toLowerCase()) {
        case "on":
          currentSettings.status = true;
          await config.group.set(
            `${safeGroupId}.security.antimedia`,
            currentSettings
          );
          reply("✅ Anti-media diaktifkan!");
          break;

        case "off":
          currentSettings.status = false;
          await config.group.set(
            `${safeGroupId}.security.antimedia`,
            currentSettings
          );
          reply("✅ Anti-media dimatikan!");
          break;

        case "config":
          if (args[1] === "max" && args[2]) {
            const maxMedia = parseInt(args[2]);
            if (maxMedia > 0 && maxMedia <= 20) {
              currentSettings.max_media = maxMedia;
              await config.group.set(
                `${safeGroupId}.security.antimedia`,
                currentSettings
              );
              reply(`✅ Max media: ${maxMedia}`);
            } else {
              reply("❌ Jumlah harus antara 1-20");
            }
          } else if (args[1] === "size" && args[2]) {
            const sizeMB = parseInt(args[2]);
            if (sizeMB > 0 && sizeMB <= 100) {
              currentSettings.max_file_size = sizeMB * 1048576;
              await config.group.set(
                `${safeGroupId}.security.antimedia`,
                currentSettings
              );
              reply(`✅ Max file size: ${sizeMB}MB`);
            } else {
              reply("❌ Size harus antara 1-100 MB");
            }
          }
          break;

        case "block":
          const validTypes = ["video", "audio", "document", "image"];
          if (args[1] === "add" && args[2]) {
            if (
              validTypes.includes(args[2]) &&
              !currentSettings.blocked_types.includes(args[2])
            ) {
              currentSettings.blocked_types.push(args[2]);
              await config.group.set(
                `${safeGroupId}.security.antimedia`,
                currentSettings
              );
              reply(`✅ ${args[2]} ditambahkan ke blocked types`);
            } else {
              reply("❌ Type tidak valid atau sudah ada");
            }
          } else if (args[1] === "remove" && args[2]) {
            const index = currentSettings.blocked_types.indexOf(args[2]);
            if (index > -1) {
              currentSettings.blocked_types.splice(index, 1);
              await config.group.set(
                `${safeGroupId}.security.antimedia`,
                currentSettings
              );
              reply(`✅ ${args[2]} dihapus dari blocked types`);
            } else {
              reply("❌ Type tidak ditemukan");
            }
          }
          break;

        default:
          reply("❌ Gunakan: on/off/config/block");
      }
    },
  });

  // 11. Anti Forward Command
  registry.addGlobalCommand({
    name: "antiforward",
    aliases: ["forwardprotect"],
    description: "Mengatur proteksi anti-forward berlebihan",
    usage: "/antiforward <on/off/config>",
    category: "security",
    exec: async ({ args, messageInfo, reply }) => {
      if (!messageInfo.isGroup) {
        return reply("❌ Perintah ini hanya bisa digunakan di grup!");
      }

      if (!messageInfo.isAdmin) {
        return reply("❌ Hanya admin yang bisa mengatur anti-forward!");
      }

      const groupId = messageInfo.raw.key.remoteJid;
      const safeGroupId = groupId.replace(/\./g, "__");
      let currentSettings = config.group.get(
        `${safeGroupId}.security.antiforward`
      );

      if (args.length === 0) {
        let info = `↪️ *PENGATURAN ANTI-FORWARD*\n\n`;
        info += `Status: ${
          currentSettings.status ? "✅ Aktif" : "❌ Nonaktif"
        }\n`;
        info += `Max Forwards: ${currentSettings.max_forwards}\n`;
        info += `Time Window: ${currentSettings.time_window} detik\n`;
        info += `Action: ${currentSettings.action}\n`;
        info += `Block from Broadcast: ${
          currentSettings.block_from_broadcast ? "Ya" : "Tidak"
        }\n\n`;
        info += `📝 *Commands:*\n`;
        info += `• /antiforward on/off\n`;
        info += `• /antiforward config max <angka>\n`;
        info += `• /antiforward config broadcast <on/off>`;

        return reply(info);
      }

      switch (args[0].toLowerCase()) {
        case "on":
          currentSettings.status = true;
          await config.group.set(
            `${safeGroupId}.security.antiforward`,
            currentSettings
          );
          reply("✅ Anti-forward diaktifkan!");
          break;

        case "off":
          currentSettings.status = false;
          await config.group.set(
            `${safeGroupId}.security.antiforward`,
            currentSettings
          );
          reply("✅ Anti-forward dimatikan!");
          break;

        case "config":
          if (args[1] === "max" && args[2]) {
            const maxForwards = parseInt(args[2]);
            if (maxForwards > 0 && maxForwards <= 10) {
              currentSettings.max_forwards = maxForwards;
              await config.group.set(
                `${safeGroupId}.security.antiforward`,
                currentSettings
              );
              reply(`✅ Max forwards: ${maxForwards}`);
            } else {
              reply("❌ Jumlah harus antara 1-10");
            }
          } else if (args[1] === "broadcast" && args[2]) {
            const broadcastValue = args[2].toLowerCase() === "on";
            currentSettings.block_from_broadcast = broadcastValue;
            await config.group.set(
              `${safeGroupId}.security.antiforward`,
              currentSettings
            );
            reply(
              `✅ Block from broadcast: ${
                broadcastValue ? "Diaktifkan" : "Dimatikan"
              }`
            );
          }
          break;

        default:
          reply("❌ Gunakan: on/off/config");
      }
    },
  });

  // 12. Raid Protection Command
  registry.addGlobalCommand({
    name: "raidprotection",
    aliases: ["antiraid", "raidprotect"],
    description: "Mengatur perlindungan dari serangan grup",
    usage: "/raidprotection <on/off/config>",
    category: "security",
    exec: async ({ args, messageInfo, reply }) => {
      if (!messageInfo.isGroup) {
        return reply("❌ Perintah ini hanya bisa digunakan di grup!");
      }

      if (!messageInfo.isAdmin) {
        return reply("❌ Hanya admin yang bisa mengatur raid protection!");
      }

      const groupId = messageInfo.raw.key.remoteJid;
      const safeGroupId = groupId.replace(/\./g, "__");
      let currentSettings = config.group.get(
        `${safeGroupId}.security.raidprotection`
      );

      if (args.length === 0) {
        let info = `🛡️ *PENGATURAN RAID PROTECTION*\n\n`;
        info += `Status: ${
          currentSettings.status ? "✅ Aktif" : "❌ Nonaktif"
        }\n`;
        info += `Max New Members: ${currentSettings.max_new_members}\n`;
        info += `Time Window: ${currentSettings.time_window} detik\n`;
        info += `Action: ${currentSettings.action}\n`;
        info += `Auto Recovery: ${currentSettings.auto_recovery_time} detik\n`;
        info += `Kick New Members: ${
          currentSettings.kick_new_members ? "Ya" : "Tidak"
        }\n`;
        info += `Alert Admins: ${
          currentSettings.alert_admins ? "Ya" : "Tidak"
        }\n\n`;
        info += `📝 *Commands:*\n`;
        info += `• /raidprotection on/off\n`;
        info += `• /raidprotection config max <angka>\n`;
        info += `• /raidprotection config action <lockgroup/kickall/alertadmins>`;

        return reply(info);
      }

      switch (args[0].toLowerCase()) {
        case "on":
          currentSettings.status = true;
          await config.group.set(
            `${safeGroupId}.security.raidprotection`,
            currentSettings
          );
          reply("✅ Raid protection diaktifkan!");
          break;

        case "off":
          currentSettings.status = false;
          await config.group.set(
            `${safeGroupId}.security.raidprotection`,
            currentSettings
          );
          reply("✅ Raid protection dimatikan!");
          break;

        case "config":
          if (args[1] === "max" && args[2]) {
            const maxMembers = parseInt(args[2]);
            if (maxMembers > 0 && maxMembers <= 20) {
              currentSettings.max_new_members = maxMembers;
              await config.group.set(
                `${safeGroupId}.security.raidprotection`,
                currentSettings
              );
              reply(`✅ Max new members: ${maxMembers}`);
            } else {
              reply("❌ Jumlah harus antara 1-20");
            }
          } else if (args[1] === "action" && args[2]) {
            const validActions = ["lockgroup", "kickall", "alertadmins"];
            if (validActions.includes(args[2])) {
              currentSettings.action = args[2];
              await config.group.set(
                `${safeGroupId}.security.raidprotection`,
                currentSettings
              );
              reply(`✅ Action: ${args[2]}`);
            } else {
              reply("❌ Action valid: lockgroup, kickall, alertadmins");
            }
          }
          break;

        default:
          reply("❌ Gunakan: on/off/config");
      }
    },
  });

  // 13. Welcome Message Command
  registry.addGlobalCommand({
    name: "welcome",
    aliases: ["setwelcome"],
    description: "Mengatur pesan welcome di grup",
    usage: "/welcome <on/off/message/view>",
    category: "group",
    exec: async ({ args, messageInfo, reply }) => {
      if (!messageInfo.isGroup)
        return reply("❌ Perintah ini hanya dapat digunakan dalam grup.");

      if (!messageInfo.isAdmin)
        return reply("❌ Hanya admin yang dapat mengatur fitur ini.");

      const groupId = messageInfo.raw.key.remoteJid;
      const safeGroupId = groupId.replace(/\./g, "__");
      let current = config.group.get(`${safeGroupId}.moderation.welcome`);

      if (!args[0]) {
        let info = `👋 *PENGATURAN WELCOME MESSAGE*\n\n`;
        info += `Status: ${current.status ? "✅ Aktif" : "❌ Nonaktif"}\n`;
        info += `Pesan: ${current.message}\n\n`;
        info += `📝 Commands:\n`;
        info += `• /welcome on/off\n`;
        info += `• /welcome message <pesan custom>\n`;
        info += `• Gunakan tag: @{user}, @{group}`;
        return reply(info);
      }

      const cmd = args[0].toLowerCase();
      if (cmd === "on") {
        current.status = true;
        await config.group.set(`${safeGroupId}.moderation.welcome`, current);
        return reply("✅ Welcome message diaktifkan.");
      } else if (cmd === "off") {
        current.status = false;
        await config.group.set(`${safeGroupId}.moderation.welcome`, current);
        return reply("✅ Welcome message dimatikan.");
      } else if (cmd === "message") {
        const text = args.slice(1).join(" ");
        if (!text) return reply("❌ Masukkan pesan welcome!");
        current.message = text;
        await config.group.set(`${safeGroupId}.moderation.welcome`, current);
        return reply("✅ Pesan welcome diperbarui.");
      } else {
        return reply("❌ Gunakan: on/off/message");
      }
    },
  });

  // 14. Goodbye Message Command
  registry.addGlobalCommand({
    name: "goodbye",
    aliases: ["setgoodbye"],
    description: "Mengatur pesan goodbye saat user keluar",
    usage: "/goodbye <on/off/message/view>",
    category: "group",
    exec: async ({ args, messageInfo, reply }) => {
      if (!messageInfo.isGroup)
        return reply("❌ Perintah ini hanya dapat digunakan dalam grup.");

      if (!messageInfo.isAdmin)
        return reply("❌ Hanya admin yang dapat mengatur fitur ini.");
      const groupId = messageInfo.raw.key.remoteJid;
      const safeGroupId = groupId.replace(/\./g, "__");
      let current = config.group.get(`${safeGroupId}.moderation.goodbye`);
      console.log(current);
      if (!current.status === false) return reply("fitur goodbye sudah on");
      if (!args[0]) {
        let info = `👋 *PENGATURAN GOODBYE MESSAGE*\n\n`;
        info += `Status: ${current.status ? "✅ Aktif" : "❌ Nonaktif"}\n`;
        info += `Pesan: ${current.message}\n\n`;
        info += `📝 Commands:\n`;
        info += `• /goodbye on/off\n`;
        info += `• /goodbye message <pesan custom>\n`;
        info += `• Gunakan tag: @{user}, @{group}`;
        return reply(info);
      }

      const cmd = args[0].toLowerCase();
      if (cmd === "on") {
        current.status = true;
        const items = await config.group.set(
          `${safeGroupId}.moderation.goodbye`,
          current
        );
        console.log(items);
        return reply("✅ Goodbye message diaktifkan.");
      } else if (cmd === "off") {
        current.status = false;
        await config.group.set(`${safeGroupId}.moderation.goodbye`, current);
        return reply("✅ Goodbye message dimatikan.");
      } else if (cmd === "message") {
        const text = args.slice(1).join(" ");
        if (!text) return reply("❌ Masukkan pesan goodbye!");
        current.message = text;
        await config.group.set(`${safeGroupId}.moderation.goodbye`, current);
        return reply("✅ Pesan goodbye diperbarui.");
      } else {
        return reply("❌ Gunakan: on/off/message");
      }
    },
  });

  // 15. Tag All Command
  registry.addGlobalCommand({
    name: "tagall",
    aliases: ["tgall", "tags"],
    description: "Tag semua member grup",
    usage: "/tagall [pesan]",
    category: "group",
    exec: async ({ sock, args, messageInfo, reply }) => {
      const { sender, raw } = messageInfo;

      if (!messageInfo.isGroup)
        return reply("❌ Perintah ini hanya dapat digunakan dalam grup.");

      if (!messageInfo.isAdmin)
        return reply("❌ Hanya admin yang dapat menggunakan fitur ini.");

      try {
        const metadata = await sock.groupMetadata(sender);
        const participants = metadata.participants;

        let customMessage = args.length ? args.join(" ") : "📢 Tag All Members";

        const mentionList = participants
          .map((p) => `@${p.id.replace(/[^0-9]/g, "")}`)
          .join(" ");

        const finalMessage = `${customMessage}\n\n${mentionList}`;

        await sock.sendMessage(
          sender,
          {
            text: finalMessage,
            mentions: participants.map((p) => p.id),
          },
          { quoted: raw }
        );
      } catch (error) {
        console.log("Error in tagall:", error);
        reply("❌ Gagal melakukan tag all. Silakan coba lagi.");
      }
    },
  });

  // 16. Hidden Tag Command
  registry.addGlobalCommand({
    name: "hidetag",
    aliases: ["htag", "ht"],
    description: "Kirim pesan tersembunyi untuk semua member",
    usage: "/hidetag [pesan]",
    category: "group",
    exec: async ({ sock, args, messageInfo, reply }) => {
      const { sender, raw } = messageInfo;

      if (!messageInfo.isGroup)
        return reply("❌ Perintah ini hanya dapat digunakan dalam grup.");

      if (!messageInfo.isAdmin)
        return reply("❌ Hanya admin yang dapat menggunakan fitur ini.");

      try {
        const metadata = await sock.groupMetadata(sender);
        const participants = metadata.participants.map((p) => p.id);

        const message = args.length
          ? args.join(" ")
          : "💬 Pesan tersembunyi untuk semua anggota.";

        await sock.sendMessage(
          sender,
          {
            text: message,
            mentions: participants,
          },
          { quoted: raw }
        );
      } catch (error) {
        console.log("Error in hidetag:", error);
        reply("❌ Gagal melakukan hidetag. Silakan coba lagi.");
      }
    },
  });

  // 17. Kick Member Command
  registry.addGlobalCommand({
    name: "kick",
    aliases: ["kickmem", "memberout"],
    description: "Kick member dari grup",
    usage: "/kick <@user atau nomor>",
    category: "group",
    exec: async ({ sock, args, messageInfo, reply }) => {
      const { sender, raw } = messageInfo;

      if (!messageInfo.isGroup)
        return reply("❌ Perintah ini hanya dapat digunakan dalam grup.");

      if (!messageInfo.isAdmin)
        return reply("❌ Hanya admin yang dapat menggunakan fitur ini.");

      // Cek jika ada mention atau nomor
      let membersToRemove = [];

      if (messageInfo.mentionedJid && messageInfo.mentionedJid.length > 0) {
        // Jika ada yang di-mention
        membersToRemove = messageInfo.mentionedJid;
      } else if (args.length > 0) {
        // Jika ada nomor di args
        membersToRemove = args.map((num) => {
          const cleanNum = num.replace(/[^0-9]/g, "");
          return cleanNum.startsWith("0")
            ? `62${cleanNum.slice(1)}@s.whatsapp.net`
            : `${cleanNum}@s.whatsapp.net`;
        });
      } else {
        return reply(
          "❌ Masukkan nomor atau mention user yang akan dikick!\n" +
            "Contoh: /kick @user atau /kick 6281234567890"
        );
      }

      try {
        const response = await sock.groupParticipantsUpdate(
          sender,
          membersToRemove,
          "remove"
        );

        const removed = response
          .filter((r) => r.status === "200")
          .map((r) => r.jid);

        const failed = response
          .filter((r) => r.status !== "200")
          .map((r) => r.jid);

        if (removed.length > 0) {
          const removedNumbers = removed
            .map((jid) => `@${jid.replace(/[^0-9]/g, "")}`)
            .join(", ");

          await reply(`✅ Berhasil mengeluarkan: ${removedNumbers}`, {
            mentions: removed,
          });
        }

        if (failed.length > 0) {
          const failedNumbers = failed
            .map((jid) => `@${jid.replace(/[^0-9]/g, "")}`)
            .join(", ");

          await reply(
            `❌ Gagal mengeluarkan: ${failedNumbers}\n` +
              "Mungkin user sudah tidak ada di grup atau bot bukan admin.",
            { mentions: failed }
          );
        }
      } catch (error) {
        console.log("Error in kick:", error);
        await reply(`❌ Gagal mengeluarkan member: ${error.message}`);
      }
    },
  });

  // 18. Add Member Command
  registry.addGlobalCommand({
    name: "add",
    aliases: ["addmem", "invite"],
    description: "Menambahkan member ke grup",
    usage: "/add <nomor>",
    category: "group",
    exec: async ({ sock, args, messageInfo, reply }) => {
      const { sender } = messageInfo;

      if (!messageInfo.isGroup)
        return reply("❌ Perintah ini hanya dapat digunakan dalam grup.");

      if (!messageInfo.isAdmin)
        return reply("❌ Hanya admin yang dapat menggunakan fitur ini.");

      if (!args.length) {
        return reply(
          "❌ Masukkan nomor yang akan ditambahkan!\n" +
            "Contoh: /add 6281234567890"
        );
      }

      try {
        const membersToAdd = args.map((num) => {
          const cleanNum = num.replace(/[^0-9]/g, "");
          return cleanNum.startsWith("0")
            ? `62${cleanNum.slice(1)}@s.whatsapp.net`
            : `${cleanNum}@s.whatsapp.net`;
        });

        const response = await sock.groupParticipantsUpdate(
          sender,
          membersToAdd,
          "add"
        );

        const added = response
          .filter((r) => r.status === "200")
          .map((r) => r.jid);

        const failed = response
          .filter((r) => r.status !== "200")
          .map((r) => ({ jid: r.jid, status: r.status }));

        if (added.length > 0) {
          const addedNumbers = added
            .map((jid) => `@${jid.replace(/[^0-9]/g, "")}`)
            .join(", ");

          await reply(`✅ Berhasil menambahkan: ${addedNumbers}`, {
            mentions: added,
          });
        }

        if (failed.length > 0) {
          let failMsg = "❌ Gagal menambahkan:\n";
          failed.forEach((f) => {
            const num = f.jid.replace(/[^0-9]/g, "");
            let reason = "Unknown error";

            switch (f.status) {
              case "403":
                reason = "Nomor tidak terdaftar di WhatsApp";
                break;
              case "408":
                reason = "User baru saja keluar dari grup";
                break;
              case "409":
                reason = "User sudah ada di grup";
                break;
              default:
                reason = `Error code: ${f.status}`;
            }

            failMsg += `• @${num}: ${reason}\n`;
          });

          await reply(failMsg, {
            mentions: failed.map((f) => f.jid),
          });
        }
      } catch (error) {
        console.log("Error in add:", error);
        await reply(`❌ Gagal menambahkan member: ${error.message}`);
      }
    },
  });

  // 19. Promote Member Command
  registry.addGlobalCommand({
    name: "promote",
    aliases: ["admin", "makeadmin"],
    description: "Jadikan member sebagai admin",
    usage: "/promote <@user atau nomor>",
    category: "group",
    exec: async ({ sock, args, messageInfo, reply }) => {
      const { sender } = messageInfo;

      if (!messageInfo.isGroup)
        return reply("❌ Perintah ini hanya dapat digunakan dalam grup.");

      if (!messageInfo.isAdmin)
        return reply("❌ Hanya admin yang dapat menggunakan fitur ini.");

      let membersToPromote = [];

      if (messageInfo.mentionedJid && messageInfo.mentionedJid.length > 0) {
        membersToPromote = messageInfo.mentionedJid;
      } else if (args.length > 0) {
        membersToPromote = args.map((num) => {
          const cleanNum = num.replace(/[^0-9]/g, "");
          return cleanNum.startsWith("0")
            ? `62${cleanNum.slice(1)}@s.whatsapp.net`
            : `${cleanNum}@s.whatsapp.net`;
        });
      } else {
        return reply(
          "❌ Masukkan nomor atau mention user yang akan dipromote!\n" +
            "Contoh: /promote @user atau /promote 6281234567890"
        );
      }

      try {
        const response = await sock.groupParticipantsUpdate(
          sender,
          membersToPromote,
          "promote"
        );

        const promoted = response
          .filter((r) => r.status === "200")
          .map((r) => r.jid);

        const failed = response
          .filter((r) => r.status !== "200")
          .map((r) => r.jid);

        if (promoted.length > 0) {
          const promotedNumbers = promoted
            .map((jid) => `@${jid.replace(/[^0-9]/g, "")}`)
            .join(", ");

          await reply(`✅ Berhasil menjadikan admin: ${promotedNumbers}`, {
            mentions: promoted,
          });
        }

        if (failed.length > 0) {
          const failedNumbers = failed
            .map((jid) => `@${jid.replace(/[^0-9]/g, "")}`)
            .join(", ");

          await reply(
            `❌ Gagal promote: ${failedNumbers}\n` +
              "Mungkin user sudah admin atau tidak ada di grup.",
            { mentions: failed }
          );
        }
      } catch (error) {
        console.log("Error in promote:", error);
        await reply(`❌ Gagal promote member: ${error.message}`);
      }
    },
  });

  // 20. Demote Admin Command
  registry.addGlobalCommand({
    name: "demote",
    aliases: ["unadmin", "removeadmin"],
    description: "Turunkan admin menjadi member biasa",
    usage: "/demote <@user atau nomor>",
    category: "group",
    exec: async ({ sock, args, messageInfo, reply }) => {
      const { sender } = messageInfo;

      if (!messageInfo.isGroup)
        return reply("❌ Perintah ini hanya dapat digunakan dalam grup.");

      if (!messageInfo.isAdmin)
        return reply("❌ Hanya admin yang dapat menggunakan fitur ini.");

      let membersToDemote = [];

      if (messageInfo.mentionedJid && messageInfo.mentionedJid.length > 0) {
        membersToDemote = messageInfo.mentionedJid;
      } else if (args.length > 0) {
        membersToDemote = args.map((num) => {
          const cleanNum = num.replace(/[^0-9]/g, "");
          return cleanNum.startsWith("0")
            ? `62${cleanNum.slice(1)}@s.whatsapp.net`
            : `${cleanNum}@s.whatsapp.net`;
        });
      } else {
        return reply(
          "❌ Masukkan nomor atau mention user yang akan didemote!\n" +
            "Contoh: /demote @user atau /demote 6281234567890"
        );
      }

      try {
        const response = await sock.groupParticipantsUpdate(
          sender,
          membersToDemote,
          "demote"
        );

        const demoted = response
          .filter((r) => r.status === "200")
          .map((r) => r.jid);

        const failed = response
          .filter((r) => r.status !== "200")
          .map((r) => r.jid);

        if (demoted.length > 0) {
          const demotedNumbers = demoted
            .map((jid) => `@${jid.replace(/[^0-9]/g, "")}`)
            .join(", ");

          await reply(`✅ Berhasil menurunkan admin: ${demotedNumbers}`, {
            mentions: demoted,
          });
        }

        if (failed.length > 0) {
          const failedNumbers = failed
            .map((jid) => `@${jid.replace(/[^0-9]/g, "")}`)
            .join(", ");

          await reply(
            `❌ Gagal demote: ${failedNumbers}\n` +
              "Mungkin user bukan admin atau tidak ada di grup.",
            { mentions: failed }
          );
        }
      } catch (error) {
        console.log("Error in demote:", error);
        await reply(`❌ Gagal demote admin: ${error.message}`);
      }
    },
  });

  // 21. Group Info Command
  registry.addGlobalCommand({
    name: "groupinfo",
    aliases: ["ginfo", "infogroup"],
    description: "Melihat informasi grup",
    usage: "/groupinfo",
    category: "group",
    exec: async ({ sock, messageInfo, reply }) => {
      const { sender } = messageInfo;

      if (!messageInfo.isGroup)
        return reply("❌ Perintah ini hanya dapat digunakan dalam grup.");

      try {
        const metadata = await sock.groupMetadata(sender);
        const admins = metadata.participants.filter((p) => p.admin);
        const members = metadata.participants.filter((p) => !p.admin);

        let info = `📋 *INFORMASI GRUP*\n\n`;
        info += `📛 Nama: ${metadata.subject}\n`;
        info += `🆔 ID: ${metadata.id}\n`;
        info += `📝 Deskripsi: ${metadata.desc || "Tidak ada deskripsi"}\n`;
        info += `👑 Owner: @${
          metadata.owner?.replace(/[^0-9]/g, "") || "Tidak diketahui"
        }\n`;
        info += `📅 Dibuat: ${new Date(
          metadata.creation * 1000
        ).toLocaleDateString()}\n`;
        info += `👥 Total Member: ${metadata.participants.length}\n`;
        info += `👑 Admin: ${admins.length}\n`;
        info += `👤 Member: ${members.length}\n`;
        info += `🔒 Hanya Admin Kirim Pesan: ${
          metadata.announce ? "Ya" : "Tidak"
        }\n`;
        info += `🔐 Hanya Admin Edit Info: ${
          metadata.restrict ? "Ya" : "Tidak"
        }\n\n`;

        info += `👑 *DAFTAR ADMIN:*\n`;
        admins.forEach((admin, i) => {
          const role = admin.admin === "superadmin" ? "Owner" : "Admin";
          info += `${i + 1}. @${admin.id.replace(/[^0-9]/g, "")} (${role})\n`;
        });

        const mentions = [metadata.owner, ...admins.map((a) => a.id)].filter(
          Boolean
        );

        await reply(info, { mentions });
      } catch (error) {
        console.log("Error in groupinfo:", error);
        await reply("❌ Gagal mengambil informasi grup.");
      }
    },
  });

  // 22. Set Group Name Command
  registry.addGlobalCommand({
    name: "setname",
    aliases: ["setgroupname", "changename"],
    description: "Mengubah nama grup",
    usage: "/setname <nama baru>",
    category: "group",
    exec: async ({ sock, args, messageInfo, reply }) => {
      const { sender } = messageInfo;

      if (!messageInfo.isGroup)
        return reply("❌ Perintah ini hanya dapat digunakan dalam grup.");

      if (!messageInfo.isAdmin)
        return reply("❌ Hanya admin yang dapat mengubah nama grup.");

      if (!args.length) {
        return reply("❌ Masukkan nama baru untuk grup!");
      }

      const newName = args.join(" ");

      try {
        await sock.groupUpdateSubject(sender, newName);
        await reply(`✅ Nama grup berhasil diubah menjadi: "${newName}"`);
      } catch (error) {
        console.log("Error in setname:", error);
        await reply("❌ Gagal mengubah nama grup. Pastikan bot adalah admin.");
      }
    },
  });

  // 23. Set Group Description Command
  registry.addGlobalCommand({
    name: "setdesc",
    aliases: ["setdescription", "changedesc"],
    description: "Mengubah deskripsi grup",
    usage: "/setdesc <deskripsi baru>",
    category: "group",
    exec: async ({ sock, args, messageInfo, reply }) => {
      const { sender } = messageInfo;

      if (!messageInfo.isGroup)
        return reply("❌ Perintah ini hanya dapat digunakan dalam grup.");

      if (!messageInfo.isAdmin)
        return reply("❌ Hanya admin yang dapat mengubah deskripsi grup.");

      if (!args.length) {
        return reply("❌ Masukkan deskripsi baru untuk grup!");
      }

      const newDesc = args.join(" ");

      try {
        await sock.groupUpdateDescription(sender, newDesc);
        await reply(`✅ Deskripsi grup berhasil diubah menjadi:\n"${newDesc}"`);
      } catch (error) {
        console.log("Error in setdesc:", error);
        await reply(
          "❌ Gagal mengubah deskripsi grup. Pastikan bot adalah admin."
        );
      }
    },
  });

  // 24. Lock/Unlock Group Command
  registry.addGlobalCommand({
    name: "lock",
    aliases: ["lockgroup", "close"],
    description: "Kunci grup (hanya admin yang bisa kirim pesan)",
    usage: "/lock",
    category: "group",
    exec: async ({ sock, messageInfo, reply }) => {
      const { sender } = messageInfo;

      if (!messageInfo.isGroup)
        return reply("❌ Perintah ini hanya dapat digunakan dalam grup.");

      if (!messageInfo.isAdmin)
        return reply("❌ Hanya admin yang dapat mengunci grup.");

      try {
        await sock.groupSettingUpdate(sender, "announcement");
        await reply(
          "🔒 Grup telah dikunci. Hanya admin yang dapat mengirim pesan."
        );
      } catch (error) {
        console.log("Error in lock:", error);
        await reply("❌ Gagal mengunci grup. Pastikan bot adalah admin.");
      }
    },
  });

  registry.addGlobalCommand({
    name: "unlock",
    aliases: ["unlockgroup", "open"],
    description: "Buka grup (semua member bisa kirim pesan)",
    usage: "/unlock",
    category: "group",
    exec: async ({ sock, messageInfo, reply }) => {
      const { sender } = messageInfo;

      if (!messageInfo.isGroup)
        return reply("❌ Perintah ini hanya dapat digunakan dalam grup.");

      if (!messageInfo.isAdmin)
        return reply("❌ Hanya admin yang dapat membuka grup.");

      try {
        await sock.groupSettingUpdate(sender, "not_announcement");
        await reply("🔓 Grup telah dibuka. Semua member dapat mengirim pesan.");
      } catch (error) {
        console.log("Error in unlock:", error);
        await reply("❌ Gagal membuka grup. Pastikan bot adalah admin.");
      }
    },
  });
}