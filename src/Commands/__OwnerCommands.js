import { botLogger } from "../bot.js";
import config from "../config.js";
/**
 * global commands to the MessageRegistry
 * @param {MessageRegistry} registry - The command registry instance
 */

export default function (registry) {
  // Command dengan permission owner
  registry.addGlobalCommand({
    name: "restart",
    description: "Restart bot (owner only)",
    usage: "/restart",
    category: "owner",
    isowner: true,
    exec: async ({ reply }) => {
      await reply("🔄 Bot sedang direstart...");

      // Tambahkan logic restart di sini
      setTimeout(() => {
        process.exit(0);
      }, 2000);
    },
  });

  botLogger.info("✅ OwnerCommand Is Loaded");
}
