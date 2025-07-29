import config from "../config.js"

export default function (registry) {
  // 1. Enhanced Anti-Link Command
  registry.addGlobalCommand({
    name: "antilink",
    aliases: ["antilinkgroup", "linkprotect"],
    description:
      "Mengatur proteksi anti-link dengan whitelist dan pengecualian",
    usage: "/antilink <on/off/config> [options]",
    category: "security",
    exec: async ({ sock, args, messageInfo, reply, db }) => {
      if (!messageInfo.isGroup) {
        return reply("❌ Perintah ini hanya bisa digunakan di grup!");
      }

      if (!messageInfo.isAdmin) {
        return reply("❌ Hanya admin yang bisa mengatur anti-link!");
      }

      const groupId = messageInfo.from;
      const currentSettings = config.group.get(`groups.${groupId}.antilink`) || {
        status: false,
        link_blocked: ["chat.whatsapp.com", "wa.me", "t.me", "instagram.com"],
        whitelist_admins: true,
        action: "delete",
        warning_message: "⚠️ Link tidak diperbolehkan di grup ini!",
        auto_kick_after: 3,
        exceptions: ["youtube.com", "github.com"],
      };

      if (args.length === 0) {
        let info = `🔗 *PENGATURAN ANTI-LINK*\n\n`;
        info += `Status: ${
          currentSettings.status ? "✅ Aktif" : "❌ Nonaktif"
        }\n`;
        info += `Action: ${currentSettings.action}\n`;
        info += `Auto Kick: ${currentSettings.auto_kick_after}x pelanggaran\n`;
        info += `Whitelist Admin: ${
          currentSettings.whitelist_admins ? "Ya" : "Tidak"
        }\n\n`;
        info += `📋 *Link Diblokir:*\n${currentSettings.link_blocked.join(
          ", "
        )}\n\n`;
        info += `✅ *Pengecualian:*\n${currentSettings.exceptions.join(
          ", "
        )}\n\n`;
        info += `📝 *Commands:*\n`;
        info += `• /antilink on/off\n`;
        info += `• /antilink config action <delete/warn/kick>\n`;
        info += `• /antilink add <domain>\n`;
        info += `• /antilink remove <domain>\n`;
        info += `• /antilink exception <add/remove> <domain>`;

        return reply(info);
      }

      switch (args[0].toLowerCase()) {
        case "on":
          currentSettings.status = true;
          await config.group.set(`groups.${groupId}.antilink`, currentSettings);
          reply("✅ Anti-link diaktifkan!");
          break;

        case "off":
          currentSettings.status = false;
          await config.group.set(`groups.${groupId}.antilink`, currentSettings);
          reply("✅ Anti-link dimatikan!");
          break;

        case "config":
          if (args[1] === "action" && args[2]) {
            const validActions = ["delete", "warn", "kick"];
            if (validActions.includes(args[2])) {
              currentSettings.action = args[2];
              await config.group.set(`groups.${groupId}.antilink`, currentSettings);
              reply(`✅ Action anti-link diubah ke: ${args[2]}`);
            } else {
              reply("❌ Action valid: delete, warn, kick");
            }
          } else if (args[1] === "kick" && args[2]) {
            const kickCount = parseInt(args[2]);
            if (kickCount > 0 && kickCount <= 10) {
              currentSettings.auto_kick_after = kickCount;
              await config.group.set(`groups.${groupId}.antilink`, currentSettings);
              reply(`✅ Auto kick diatur setelah ${kickCount}x pelanggaran`);
            } else {
              reply("❌ Jumlah harus antara 1-10");
            }
          }
          break;

        case "add":
          if (args[1]) {
            if (!currentSettings.link_blocked.includes(args[1])) {
              currentSettings.link_blocked.push(args[1]);
              await config.group.set(`groups.${groupId}.antilink`, currentSettings);
              reply(`✅ Domain ${args[1]} ditambahkan ke blacklist`);
            } else {
              reply("❌ Domain sudah ada di blacklist");
            }
          }
          break;

        case "remove":
          if (args[1]) {
            const index = currentSettings.link_blocked.indexOf(args[1]);
            if (index > -1) {
              currentSettings.link_blocked.splice(index, 1);
              await config.group.set(`groups.${groupId}.antilink`, currentSettings);
              reply(`✅ Domain ${args[1]} dihapus dari blacklist`);
            } else {
              reply("❌ Domain tidak ditemukan di blacklist");
            }
          }
          break;

        case "exception":
          if (args[1] === "add" && args[2]) {
            if (!currentSettings.exceptions.includes(args[2])) {
              currentSettings.exceptions.push(args[2]);
              await config.group.set(`groups.${groupId}.antilink`, currentSettings);
              reply(`✅ ${args[2]} ditambahkan ke pengecualian`);
            } else {
              reply("❌ Domain sudah ada di pengecualian");
            }
          } else if (args[1] === "remove" && args[2]) {
            const index = currentSettings.exceptions.indexOf(args[2]);
            if (index > -1) {
              currentSettings.exceptions.splice(index, 1);
              await config.group.set(`groups.${groupId}.antilink`, currentSettings);
              reply(`✅ ${args[2]} dihapus dari pengecualian`);
            } else {
              reply("❌ Domain tidak ditemukan di pengecualian");
            }
          }
          break;

        default:
          reply("❌ Gunakan: on/off/config/add/remove/exception");
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
    exec: async ({ args, messageInfo, reply, db }) => {
      if (!messageInfo.isGroup) {
        return reply("❌ Perintah ini hanya bisa digunakan di grup!");
      }

      if (!messageInfo.isAdmin) {
        return reply("❌ Hanya admin yang bisa mengatur anti-spam!");
      }

      const groupId = messageInfo.from;
      const currentSettings = config.group.get(`groups.${groupId}.antispam`) || {
        status: false,
        max_same_message: 3,
        time_window: 60,
        action: "mute",
        mute_duration: 300,
        whitelist_admins: true,
        warning_message: "🚫 Spam terdeteksi! Pesan dihapus.",
        reset_count_after: 3600,
      };

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
          await config.group.set(`groups.${groupId}.antispam`, currentSettings);
          reply("✅ Anti-spam diaktifkan!");
          break;

        case "off":
          currentSettings.status = false;
          await config.group.set(`groups.${groupId}.antispam`, currentSettings);
          reply("✅ Anti-spam dimatikan!");
          break;

        case "config":
          if (args[1] === "max" && args[2]) {
            const maxMsg = parseInt(args[2]);
            if (maxMsg > 0 && maxMsg <= 20) {
              currentSettings.max_same_message = maxMsg;
              await config.group.set(`groups.${groupId}.antispam`, currentSettings);
              reply(`✅ Max pesan sama diatur ke: ${maxMsg}`);
            } else {
              reply("❌ Jumlah harus antara 1-20");
            }
          } else if (args[1] === "time" && args[2]) {
            const time = parseInt(args[2]);
            if (time >= 10 && time <= 600) {
              currentSettings.time_window = time;
              await config.group.set(`groups.${groupId}.antispam`, currentSettings);
              reply(`✅ Time window diatur ke: ${time} detik`);
            } else {
              reply("❌ Waktu harus antara 10-600 detik");
            }
          } else if (args[1] === "action" && args[2]) {
            const validActions = ["mute", "delete", "warn", "kick"];
            if (validActions.includes(args[2])) {
              currentSettings.action = args[2];
              await config.group.set(`groups.${groupId}.antispam`, currentSettings);
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
    exec: async ({ args, messageInfo, reply, db }) => {
      if (!messageInfo.isGroup) {
        return reply("❌ Perintah ini hanya bisa digunakan di grup!");
      }

      if (!messageInfo.isAdmin) {
        return reply("❌ Hanya admin yang bisa mengatur anti-flood!");
      }

      const groupId = messageInfo.from;
      const currentSettings = config.group.get(`groups.${groupId}.antiflood`) || {
        status: false,
        max_messages: 5,
        time_window: 10,
        action: "mute",
        mute_duration: 600,
        whitelist_admins: true,
        warning_message: "⚡ Pesan terlalu cepat! Mohon pelan-pelan.",
        progressive_mute: true,
        max_violations: 3,
      };

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
          await config.group.set(`groups.${groupId}.antiflood`, currentSettings);
          reply("✅ Anti-flood diaktifkan!");
          break;

        case "off":
          currentSettings.status = false;
          await config.group.set(`groups.${groupId}.antiflood`, currentSettings);
          reply("✅ Anti-flood dimatikan!");
          break;

        case "config":
          if (args[1] === "max" && args[2]) {
            const maxMsg = parseInt(args[2]);
            if (maxMsg > 0 && maxMsg <= 50) {
              currentSettings.max_messages = maxMsg;
              await config.group.set(`groups.${groupId}.antiflood`, currentSettings);
              reply(`✅ Max pesan diatur ke: ${maxMsg}`);
            } else {
              reply("❌ Jumlah harus antara 1-50");
            }
          } else if (args[1] === "time" && args[2]) {
            const time = parseInt(args[2]);
            if (time >= 5 && time <= 120) {
              currentSettings.time_window = time;
              await config.group.set(`groups.${groupId}.antiflood`, currentSettings);
              reply(`✅ Time window diatur ke: ${time} detik`);
            } else {
              reply("❌ Waktu harus antara 5-120 detik");
            }
          } else if (args[1] === "violations" && args[2]) {
            const violations = parseInt(args[2]);
            if (violations >= 1 && violations <= 10) {
              currentSettings.max_violations = violations;
              await config.group.set(`groups.${groupId}.antiflood`, currentSettings);
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
    exec: async ({ args, messageInfo, reply, db }) => {
      if (!messageInfo.isGroup) {
        return reply("❌ Perintah ini hanya bisa digunakan di grup!");
      }

      if (!messageInfo.isAdmin) {
        return reply("❌ Hanya admin yang bisa mengatur anti-tag all!");
      }

      const groupId = messageInfo.from;
      const currentSettings = config.group.get(`groups.${groupId}.antitagall`) || {
        status: false,
        max_mentions: 5,
        action: "delete",
        whitelist_admins: true,
        whitelist_users: [],
        warning_message: "⚠️ Jangan tag terlalu banyak orang sekaligus!",
        mute_duration: 300,
        allow_reply_mentions: true,
      };

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
          await config.group.set(`groups.${groupId}.antitagall`, currentSettings);
          reply("✅ Anti-tag all diaktifkan!");
          break;

        case "off":
          currentSettings.status = false;
          await config.group.set(`groups.${groupId}.antitagall`, currentSettings);
          reply("✅ Anti-tag all dimatikan!");
          break;

        case "config":
          if (args[1] === "max" && args[2]) {
            const maxMentions = parseInt(args[2]);
            if (maxMentions > 0 && maxMentions <= 20) {
              currentSettings.max_mentions = maxMentions;
              await config.group.set(`groups.${groupId}.antitagall`, currentSettings);
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
              await config.group.set(`groups.${groupId}.antitagall`, currentSettings);
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
              await config.group.set(`groups.${groupId}.antitagall`, currentSettings);
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
    exec: async ({ args, messageInfo, reply, db }) => {
      if (!messageInfo.isGroup) {
        return reply("❌ Perintah ini hanya bisa digunakan di grup!");
      }

      if (!messageInfo.isAdmin) {
        return reply("❌ Hanya admin yang bisa mengatur anti-delete!");
      }

      const groupId = messageInfo.from;
      const currentSettings = config.group.get(`groups.${groupId}.antidelete`) || {
        status: false,
        store_deleted_messages: true,
        forward_to_admins: false,
        show_in_group: true,
        max_stored_messages: 100,
        ignore_admins: true,
        message_format: "🗑️ Pesan dihapus oleh @{user}:\n{message}",
        auto_cleanup_days: 7,
      };

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
          await config.group.set(`groups.${groupId}.antidelete`, currentSettings);
          reply("✅ Anti-delete diaktifkan!");
          break;

        case "off":
          currentSettings.status = false;
          await config.group.set(`groups.${groupId}.antidelete`, currentSettings);
          reply("✅ Anti-delete dimatikan!");
          break;

        case "config":
          if (args[1] === "show" && args[2]) {
            const showValue = args[2].toLowerCase() === "on";
            currentSettings.show_in_group = showValue;
            await config.group.set(`groups.${groupId}.antidelete`, currentSettings);
            reply(
              `✅ Show in group: ${showValue ? "Diaktifkan" : "Dimatikan"}`
            );
          } else if (args[1] === "forward" && args[2]) {
            const forwardValue = args[2].toLowerCase() === "on";
            currentSettings.forward_to_admins = forwardValue;
            await config.group.set(`groups.${groupId}.antidelete`, currentSettings);
            reply(
              `✅ Forward to admins: ${
                forwardValue ? "Diaktifkan" : "Dimatikan"
              }`
            );
          } else if (args[1] === "max" && args[2]) {
            const maxStored = parseInt(args[2]);
            if (maxStored >= 10 && maxStored <= 500) {
              currentSettings.max_stored_messages = maxStored;
              await config.group.set(`groups.${groupId}.antidelete`, currentSettings);
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
    exec: async ({ args, messageInfo, reply, db }) => {
      if (!messageInfo.isGroup) {
        return reply("❌ Perintah ini hanya bisa digunakan di grup!");
      }

      if (!messageInfo.isAdmin) {
        return reply("❌ Hanya admin yang bisa mengatur word filter!");
      }

      const groupId = messageInfo.from;
      const currentSettings = config.group.get(`groups.${groupId}.wordfilter`) || {
        status: false,
        blocked_words: ["politik", "sara", "hoax"],
        blocked_phrases: ["jual beli", "open bo", "investasi bodong"],
        action: "delete",
        warning_message: "⚠️ Pesan mengandung kata/frasa yang difilter",
        case_sensitive: false,
        whitelist_admins: true,
        auto_replace: false,
        replacement_text: "[FILTERED]",
      };

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
          await config.group.set(`groups.${groupId}.wordfilter`, currentSettings);
          reply("✅ Word filter diaktifkan!");
          break;

        case "off":
          currentSettings.status = false;
          await config.group.set(`groups.${groupId}.wordfilter`, currentSettings);
          reply("✅ Word filter dimatikan!");
          break;

        case "add":
          if (args[1]) {
            const word = args.slice(1).join(" ").toLowerCase();
            if (!currentSettings.blocked_words.includes(word)) {
              currentSettings.blocked_words.push(word);
              await config.group.set(`groups.${groupId}.wordfilter`, currentSettings);
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
              await config.group.set(`groups.${groupId}.wordfilter`, currentSettings);
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
              await config.group.set(`groups.${groupId}.wordfilter`, currentSettings);
              reply(`✅ Frasa "${phrase}" ditambahkan ke filter`);
            } else {
              reply("❌ Frasa sudah ada di filter");
            }
          } else if (args[1] === "remove" && args[2]) {
            const phrase = args.slice(2).join(" ").toLowerCase();
            const index = currentSettings.blocked_phrases.indexOf(phrase);
            if (index > -1) {
              currentSettings.blocked_phrases.splice(index, 1);
              await config.group.set(`groups.${groupId}.wordfilter`, currentSettings);
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
  registry.addGlobalCommand({
    name: "nightmode",
    aliases: ["night", "malam"],
    description: "Mengatur mode malam grup",
    usage: "/nightmode <on/off/config>",
    category: "security",
    exec: async ({ args, messageInfo, reply, db }) => {
      if (!messageInfo.isGroup) {
        return reply("❌ Perintah ini hanya bisa digunakan di grup!");
      }

      if (!messageInfo.isAdmin) {
        return reply("❌ Hanya admin yang bisa mengatur night mode!");
      }

      const groupId = messageInfo.from;
      const currentSettings = config.group.get(`groups.${groupId}.nightmode`) || {
        status: false,
        start_time: "22:00",
        end_time: "06:00",
        timezone: "Asia/Jakarta",
        allowed_actions: ["admin_commands"],
        mute_non_admins: true,
        auto_message:
          "🌙 Grup dalam mode malam. Chat dibatasi hingga pagi hari.",
        weekend_mode: false,
      };

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
          await config.group.set(`groups.${groupId}.nightmode`, currentSettings);
          reply("✅ Night mode diaktifkan!");
          break;

        case "off":
          currentSettings.status = false;
          await config.group.set(`groups.${groupId}.nightmode`, currentSettings);
          reply("✅ Night mode dimatikan!");
          break;

        case "config":
          if (args[1] === "time" && args[2] && args[3]) {
            const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
            if (timeRegex.test(args[2]) && timeRegex.test(args[3])) {
              currentSettings.start_time = args[2];
              currentSettings.end_time = args[3];
              await config.group.set(`groups.${groupId}.nightmode`, currentSettings);
              reply(`✅ Waktu night mode: ${args[2]} - ${args[3]}`);
            } else {
              reply("❌ Format waktu salah! Gunakan HH:MM (contoh: 22:00)");
            }
          } else if (args[1] === "weekend" && args[2]) {
            const weekendValue = args[2].toLowerCase() === "on";
            currentSettings.weekend_mode = weekendValue;
            await config.group.set(`groups.${groupId}.nightmode`, currentSettings);
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
    exec: async ({ args, messageInfo, reply, db }) => {
      if (!messageInfo.isGroup) {
        return reply("❌ Perintah ini hanya bisa digunakan di grup!");
      }

      if (!messageInfo.isAdmin) {
        return reply("❌ Hanya admin yang bisa mengatur anti-view once!");
      }

      const groupId = messageInfo.from;
      const currentSettings = config.group.get(`groups.${groupId}.antiviewonce`) || {
        status: false,
        save_viewonce: true,
        forward_to_admins: false,
        show_in_group: false,
        warning_message: "👁️ View once message terdeteksi dan disimpan",
        storage_limit: 50,
        auto_cleanup_days: 3,
      };

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
          await config.group.set(`groups.${groupId}.antiviewonce`, currentSettings);
          reply("✅ Anti-view once diaktifkan!");
          break;

        case "off":
          currentSettings.status = false;
          await config.group.set(`groups.${groupId}.antiviewonce`, currentSettings);
          reply("✅ Anti-view once dimatikan!");
          break;

        case "config":
          if (args[1] === "save" && args[2]) {
            const saveValue = args[2].toLowerCase() === "on";
            currentSettings.save_viewonce = saveValue;
            await config.group.set(`groups.${groupId}.antiviewonce`, currentSettings);
            reply(
              `✅ Save view once: ${saveValue ? "Diaktifkan" : "Dimatikan"}`
            );
          } else if (args[1] === "forward" && args[2]) {
            const forwardValue = args[2].toLowerCase() === "on";
            currentSettings.forward_to_admins = forwardValue;
            await config.group.set(`groups.${groupId}.antiviewonce`, currentSettings);
            reply(
              `✅ Forward to admins: ${
                forwardValue ? "Diaktifkan" : "Dimatikan"
              }`
            );
          } else if (args[1] === "limit" && args[2]) {
            const limit = parseInt(args[2]);
            if (limit >= 10 && limit <= 200) {
              currentSettings.storage_limit = limit;
              await config.group.set(`groups.${groupId}.antiviewonce`, currentSettings);
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

  // 9. Anti Call Command
  registry.addGlobalCommand({
    name: "anticall",
    aliases: ["callprotect", "blockCall"],
    description: "Mengatur proteksi anti-call",
    usage: "/anticall <on/off/config>",
    category: "security",
    exec: async ({ args, messageInfo, reply, db }) => {
      if (!messageInfo.isGroup) {
        return reply("❌ Perintah ini hanya bisa digunakan di grup!");
      }

      if (!messageInfo.isAdmin) {
        return reply("❌ Hanya admin yang bisa mengatur anti-call!");
      }

      const groupId = messageInfo.from;
      const currentSettings = config.group.get(`groups.${groupId}.anticall`) || {
        status: false,
        action: "reject",
        auto_block: false,
        warning_message:
          "📞 Panggilan otomatis ditolak. Gunakan chat untuk komunikasi.",
        whitelist_admins: true,
        whitelist_contacts: [],
        log_calls: true,
      };

      if (args.length === 0) {
        let info = `📞 *PENGATURAN ANTI-CALL*\n\n`;
        info += `Status: ${
          currentSettings.status ? "✅ Aktif" : "❌ Nonaktif"
        }\n`;
        info += `Action: ${currentSettings.action}\n`;
        info += `Auto Block: ${currentSettings.auto_block ? "Ya" : "Tidak"}\n`;
        info += `Whitelist Admins: ${
          currentSettings.whitelist_admins ? "Ya" : "Tidak"
        }\n`;
        info += `Log Calls: ${currentSettings.log_calls ? "Ya" : "Tidak"}\n`;
        info += `Whitelist Contacts: ${currentSettings.whitelist_contacts.length}\n\n`;
        info += `📝 *Commands:*\n`;
        info += `• /anticall on/off\n`;
        info += `• /anticall config action <reject/block>\n`;
        info += `• /anticall whitelist <add/remove> <@user>`;

        return reply(info);
      }

      switch (args[0].toLowerCase()) {
        case "on":
          currentSettings.status = true;
          await config.group.set(`groups.${groupId}.anticall`, currentSettings);
          reply("✅ Anti-call diaktifkan!");
          break;

        case "off":
          currentSettings.status = false;
          await config.group.set(`groups.${groupId}.anticall`, currentSettings);
          reply("✅ Anti-call dimatikan!");
          break;

        case "config":
          if (args[1] === "action" && args[2]) {
            const validActions = ["reject", "block"];
            if (validActions.includes(args[2])) {
              currentSettings.action = args[2];
              await config.group.set(`groups.${groupId}.anticall`, currentSettings);
              reply(`✅ Action diubah ke: ${args[2]}`);
            } else {
              reply("❌ Action valid: reject, block");
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
            if (!currentSettings.whitelist_contacts.includes(userJid)) {
              currentSettings.whitelist_contacts.push(userJid);
              await config.group.set(`groups.${groupId}.anticall`, currentSettings);
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
            const index = currentSettings.whitelist_contacts.indexOf(userJid);
            if (index > -1) {
              currentSettings.whitelist_contacts.splice(index, 1);
              await config.group.set(`groups.${groupId}.anticall`, currentSettings);
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

  // 10. Anti Sticker Command
  registry.addGlobalCommand({
    name: "antisticker",
    aliases: ["stickerprotect"],
    description: "Mengatur proteksi anti-sticker spam",
    usage: "/antisticker <on/off/config>",
    category: "security",
    exec: async ({ args, messageInfo, reply, db }) => {
      if (!messageInfo.isGroup) {
        return reply("❌ Perintah ini hanya bisa digunakan di grup!");
      }

      if (!messageInfo.isAdmin) {
        return reply("❌ Hanya admin yang bisa mengatur anti-sticker!");
      }

      const groupId = messageInfo.from;
      const currentSettings = config.group.get(`groups.${groupId}.antisticker`) || {
        status: false,
        max_stickers: 3,
        time_window: 30,
        action: "delete",
        warning_message: "🎭 Jangan spam sticker!",
        whitelist_admins: true,
        mute_duration: 300,
      };

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
          await config.group.set(`groups.${groupId}.antisticker`, currentSettings);
          reply("✅ Anti-sticker diaktifkan!");
          break;

        case "off":
          currentSettings.status = false;
          await config.group.set(`groups.${groupId}.antisticker`, currentSettings);
          reply("✅ Anti-sticker dimatikan!");
          break;

        case "config":
          if (args[1] === "max" && args[2]) {
            const maxStickers = parseInt(args[2]);
            if (maxStickers > 0 && maxStickers <= 20) {
              currentSettings.max_stickers = maxStickers;
              await config.group.set(`groups.${groupId}.antisticker`, currentSettings);
              reply(`✅ Max stickers: ${maxStickers}`);
            } else {
              reply("❌ Jumlah harus antara 1-20");
            }
          } else if (args[1] === "time" && args[2]) {
            const time = parseInt(args[2]);
            if (time >= 10 && time <= 300) {
              currentSettings.time_window = time;
              await config.group.set(`groups.${groupId}.antisticker`, currentSettings);
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

  // 11. Anti Media Command
  registry.addGlobalCommand({
    name: "antimedia",
    aliases: ["mediaprotect"],
    description: "Mengatur proteksi anti-media spam",
    usage: "/antimedia <on/off/config>",
    category: "security",
    exec: async ({ args, messageInfo, reply, db }) => {
      if (!messageInfo.isGroup) {
        return reply("❌ Perintah ini hanya bisa digunakan di grup!");
      }

      if (!messageInfo.isAdmin) {
        return reply("❌ Hanya admin yang bisa mengatur anti-media!");
      }

      const groupId = messageInfo.from;
      const currentSettings = config.group.get(`groups.${groupId}.antimedia`) || {
        status: false,
        max_media: 3,
        time_window: 60,
        blocked_types: ["video", "audio", "document"],
        max_file_size: 10485760, // 10MB
        action: "delete",
        warning_message: "📎 Media spam terdeteksi!",
        whitelist_admins: true,
      };

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
          await config.group.set(`groups.${groupId}.antimedia`, currentSettings);
          reply("✅ Anti-media diaktifkan!");
          break;

        case "off":
          currentSettings.status = false;
          await config.group.set(`groups.${groupId}.antimedia`, currentSettings);
          reply("✅ Anti-media dimatikan!");
          break;

        case "config":
          if (args[1] === "max" && args[2]) {
            const maxMedia = parseInt(args[2]);
            if (maxMedia > 0 && maxMedia <= 20) {
              currentSettings.max_media = maxMedia;
              await config.group.set(`groups.${groupId}.antimedia`, currentSettings);
              reply(`✅ Max media: ${maxMedia}`);
            } else {
              reply("❌ Jumlah harus antara 1-20");
            }
          } else if (args[1] === "size" && args[2]) {
            const sizeMB = parseInt(args[2]);
            if (sizeMB > 0 && sizeMB <= 100) {
              currentSettings.max_file_size = sizeMB * 1048576;
              await config.group.set(`groups.${groupId}.antimedia`, currentSettings);
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
              await config.group.set(`groups.${groupId}.antimedia`, currentSettings);
              reply(`✅ ${args[2]} ditambahkan ke blocked types`);
            } else {
              reply("❌ Type tidak valid atau sudah ada");
            }
          } else if (args[1] === "remove" && args[2]) {
            const index = currentSettings.blocked_types.indexOf(args[2]);
            if (index > -1) {
              currentSettings.blocked_types.splice(index, 1);
              await config.group.set(`groups.${groupId}.antimedia`, currentSettings);
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

  // 12. Anti Forward Command
  registry.addGlobalCommand({
    name: "antiforward",
    aliases: ["forwardprotect"],
    description: "Mengatur proteksi anti-forward berlebihan",
    usage: "/antiforward <on/off/config>",
    category: "security",
    exec: async ({ args, messageInfo, reply, db }) => {
      if (!messageInfo.isGroup) {
        return reply("❌ Perintah ini hanya bisa digunakan di grup!");
      }

      if (!messageInfo.isAdmin) {
        return reply("❌ Hanya admin yang bisa mengatur anti-forward!");
      }

      const groupId = messageInfo.from;
      const currentSettings = config.group.get(`groups.${groupId}.antiforward`) || {
        status: false,
        max_forwards: 2,
        time_window: 300,
        action: "delete",
        warning_message: "↪️ Jangan terlalu banyak forward pesan!",
        whitelist_admins: true,
        block_from_broadcast: true,
      };

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
          await config.group.set(`groups.${groupId}.antiforward`, currentSettings);
          reply("✅ Anti-forward diaktifkan!");
          break;

        case "off":
          currentSettings.status = false;
          await config.group.set(`groups.${groupId}.antiforward`, currentSettings);
          reply("✅ Anti-forward dimatikan!");
          break;

        case "config":
          if (args[1] === "max" && args[2]) {
            const maxForwards = parseInt(args[2]);
            if (maxForwards > 0 && maxForwards <= 10) {
              currentSettings.max_forwards = maxForwards;
              await config.group.set(`groups.${groupId}.antiforward`, currentSettings);
              reply(`✅ Max forwards: ${maxForwards}`);
            } else {
              reply("❌ Jumlah harus antara 1-10");
            }
          } else if (args[1] === "broadcast" && args[2]) {
            const broadcastValue = args[2].toLowerCase() === "on";
            currentSettings.block_from_broadcast = broadcastValue;
            await config.group.set(`groups.${groupId}.antiforward`, currentSettings);
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

  // 13. Raid Protection Command
  registry.addGlobalCommand({
    name: "raidprotection",
    aliases: ["antiraid", "raidprotect"],
    description: "Mengatur perlindungan dari serangan grup",
    usage: "/raidprotection <on/off/config>",
    category: "security",
    exec: async ({ args, messageInfo, reply, db }) => {
      if (!messageInfo.isGroup) {
        return reply("❌ Perintah ini hanya bisa digunakan di grup!");
      }

      if (!messageInfo.isAdmin) {
        return reply("❌ Hanya admin yang bisa mengatur raid protection!");
      }

      const groupId = messageInfo.from;
      const currentSettings = config.group.get(`groups.${groupId}.raidprotection`) || {
        status: false,
        max_new_members: 5,
        time_window: 300,
        action: "lockgroup",
        auto_recovery_time: 1800,
        kick_new_members: true,
        alert_admins: true,
        emergency_contacts: [],
        whitelist_adders: [],
      };

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
          await config.group.set(`groups.${groupId}.raidprotection`, currentSettings);
          reply("✅ Raid protection diaktifkan!");
          break;

        case "off":
          currentSettings.status = false;
          await config.group.set(`groups.${groupId}.raidprotection`, currentSettings);
          reply("✅ Raid protection dimatikan!");
          break;

        case "config":
          if (args[1] === "max" && args[2]) {
            const maxMembers = parseInt(args[2]);
            if (maxMembers > 0 && maxMembers <= 20) {
              currentSettings.max_new_members = maxMembers;
              await config.group.set(`groups.${groupId}.raidprotection`, currentSettings);
              reply(`✅ Max new members: ${maxMembers}`);
            } else {
              reply("❌ Jumlah harus antara 1-20");
            }
          } else if (args[1] === "action" && args[2]) {
            const validActions = ["lockgroup", "kickall", "alertadmins"];
            if (validActions.includes(args[2])) {
              currentSettings.action = args[2];
              await config.group.set(`groups.${groupId}.raidprotection`, currentSettings);
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
}
