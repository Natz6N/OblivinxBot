import { botLogger } from "../bot.js";
/**
 * global commands to the MessageRegistry
 * @param {MessageRegistry} registry - The command registry instance
 */

export default function (registry) {
  // Command dengan permission owner
  registry.addGlobalCommand({
    name: "restart",
    aliases: ["reboot", "mulaiulang"],
    description: "Restart bot (Owner only)",
    usage: "restart",
    category: "owner",
    ownerOnly: true,
    exec: async (sock, msg) => {
      try {
        await sock.sendMessage(msg.key.remoteJid, {
          text: "🔄 Bot akan restart dalam 3 detik...",
        });

        // Delay untuk mengirim pesan
        setTimeout(() => {
          console.log("🔄 Bot restart dari WhatsApp command");
          process.exit(1); // Exit dengan code 1 untuk auto-restart jika menggunakan PM2
        }, 3000);
      } catch (error) {
        console.error("Error in restart command:", error);
        await sock.sendMessage(msg.key.remoteJid, {
          text: "❌ Terjadi error saat restart bot",
        });
      }
    },
  });
  registry.addGlobalCommand({
    name: "start",
    aliases: ["start", "mulai"],
    description: "start bot (Owner only)",
    usage: "start",
    category: "owner",
    ownerOnly: true,
    exec: async (sock, msg) => {
      try {
        await sock.sendMessage(msg.key.remoteJid, {
          text: "🔄 Bot akan restart dalam 3 detik...",
        });

        // Delay untuk mengirim pesan
        setTimeout(() => {
          console.log("🔄 Bot restart dari WhatsApp command");
          process.exit(1); // Exit dengan code 1 untuk auto-restart jika menggunakan PM2
        }, 3000);
      } catch (error) {
        console.error("Error in restart command:", error);
        await sock.sendMessage(msg.key.remoteJid, {
          text: "❌ Terjadi error saat restart bot",
        });
      }
    },
  });
  registry.addGlobalCommand({
    name: "shutdown",
    aliases: ["std", "matikan"],
    description: "shutdown bot (Owner only)",
    usage: "shutdown",
    category: "owner",
    ownerOnly: true,
    exec: async (sock, msg) => {
      try {
        await sock.sendMessage(msg.key.remoteJid, {
          text: "🔄 Bot akan restart dalam 3 detik...",
        });

        // Delay untuk mengirim pesan
        setTimeout(() => {
          console.log("🔄 Bot restart dari WhatsApp command");
          process.exit(1); // Exit dengan code 1 untuk auto-restart jika menggunakan PM2
        }, 3000);
      } catch (error) {
        console.error("Error in restart command:", error);
        await sock.sendMessage(msg.key.remoteJid, {
          text: "❌ Terjadi error saat restart bot",
        });
      }
    },
  });

  botLogger.info("✅ OwnerCommand Is Loaded");
}
