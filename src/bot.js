// bot.js - Main bot initialization file
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  isJidNewsletter,
} from "@whiskeysockets/baileys";
import Pino from "pino";
import qrcode from "qrcode-terminal";
import * as Boom from "@hapi/boom";
import { MessageRegistry } from "./Clients/RegistryCommands.js";
import {
  createMessageHandler,
  processMessageFromQueue,
  delay,
} from "./Clients/messageClients.js";
import os from "os";
import { setupAntiCall } from "./Clients/Settings/antiCall.js";
import config from "./config.js";
import dayjs from "dayjs"; // opsional, untuk format waktu

const groupCache = new Map();
let pairingCodeRequested = false;

// Create logger
export const botLogger = Pino({
  level: "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
    },
  },
});

export default async function initBot(queue) {
  try {
    const chalk = await import("chalk").then((m) => m.default);

    const { state, saveCreds } = await useMultiFileAuthState("__oblivinx_auth");

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      logger: Pino({ level: "silent" }),
      browser: ["Oblivinx Bot", "Chrome", "1.0.0"],
      cachedGroupMetadata: async (jid) => groupCache.get(jid),
    });

    const registry = new MessageRegistry(sock, botLogger);
    const owners = config.ownerDB.get("owners", []) || [];
    registry.setPrefix(config.prefix).setOwners(owners);
    queue.setDefaultHandler(processMessageFromQueue);

    // Handle credentials update
    sock.ev.on("creds.update", saveCreds);
    setupAntiCall(sock, config.callDB, botLogger);
    // Handle group updates
    sock.ev.on("groups.update", async (events) => {
      for (const event of events) {
        try {
          const metadata = await sock.groupMetadata(event.id);
          groupCache.set(event.id, metadata);
        } catch (error) {
          botLogger.error("Error updating group metadata:", error);
        }
      }
    });

    // Handle group participants update
    sock.ev.on("group-participants.update", async (event) => {
      try {
        const metadata = await sock.groupMetadata(event.id);
        groupCache.set(event.id, metadata);
      } catch (error) {
        botLogger.error("Error updating group participants:", error);
      }
    });

    // Create message handler with registry integration
    const messageHandler = createMessageHandler(
      sock,
      registry,
      botLogger,
      groupCache,
      queue,
    );

    sock.ev.on("messages.upsert", messageHandler);

    // Handle connection updates
    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // Handle QR code
      if (qr) {
        console.log("QR RECEIVED");
        qrcode.generate(qr, { small: true });

        // Pairing code example (disabled by default)
        const pairingCodeEnabled = false;
        if (pairingCodeEnabled && !pairingCodeRequested) {
          try {
            const pairingCode = await sock.requestPairingCode(
              prompt("Please enter your name:")
            );
            console.log("Pairing code enabled, code: " + pairingCode);
            pairingCodeRequested = true;
          } catch (error) {
            console.error("Error requesting pairing code:", error);
          }
        }
      }

      // Handle connection status
      if (connection === "close") {
        const shouldReconnect =
          lastDisconnect?.error instanceof Boom.Boom &&
          lastDisconnect.error.output?.statusCode !==
            DisconnectReason.loggedOut;

        if (shouldReconnect) {
          console.log("Connection closed, reconnecting...");
          await delay(2000);
          await initBot();
        } else {
          console.log("Connection logged out. Please scan QR again.");
        }
      } else if (connection === "open") {
        console.log("");
        console.log("✅ Bot connected successfully!");
        botLogger.info("Bot is ready to receive messages!");
        console.clear();
        console.log(`
  ____  _     _ _        _          ____        _   
 / __ \| |   | (_)      (_)        |  _ \      | |  
| |  | | |__ | |___  ___ _ _ __  __| |_) | ___ | |_ 
| |  | | '_ \| | \ \/ / | | '_ \/ __|  _ < / _ \| __|
| |__| | |_) | | |>  <| | | | | \__ \ |_) | (_) | |_ 
 \____/|_.__/|_|_/_/\_\_|_|_| |_|___/____/ \___/ \__|
                                                    
====================================================== 
    Versi: ${config.Botinfo.version}          Dibuat oleh: Natz6N
====================================================== 
          `);
        console.log(
          chalk.green.bold("╭─────────────────────────────────────────────╮")
        );
        console.log(
          chalk.green.bold("│         🤖 Bot WhatsApp Aktif! 🎉           │")
        );
        console.log(
          chalk.green.bold("╰─────────────────────────────────────────────╯")
        );

        console.log(`${chalk.cyan("📌 Author      :")} Natz6N`);
        console.log(`${chalk.cyan("🌐 Instagram   :")} Natz6N`);
        console.log(`${chalk.cyan("🐱 GitHub      :")} Natz6N`);
        console.log(`${chalk.cyan("🔧 Prefix      :")} ${config.prefix}`);
        console.log(
          `${chalk.cyan("🕒 Started at  :")} ${dayjs().format(
            "YYYY-MM-DD HH:mm:ss"
          )}`
        );
        console.log(`${chalk.cyan("💻 Hostname    :")} ${os.hostname()}`);
        console.log(
          `${chalk.cyan("🖥️ Platform    :")} ${os.platform()} ${os.arch()}`
        );
        console.log(`${chalk.cyan("📂 Working Dir :")} ${process.cwd()}`);
        console.log(`${chalk.cyan("🧠 CPU Model   :")} ${os.cpus()[0].model}`);
        console.log(
          `${chalk.cyan("🧠 Total CPU   :")} ${os.cpus().length} core(s)`
        );
        console.log(
          `${chalk.cyan("💾 RAM         :")} ${Math.round(
            os.totalmem() / 1024 / 1024
          )} MB`
        );
        console.log(`${chalk.cyan(" Owner         :")} ${owners}`);
        console.log(
          chalk.green.bold("\n🔥 Trimakasih sudah menggunakan bot ini!")
        );
        console.log(chalk.green.bold("📣 Jangan lupa support terus ya 💖"));
        console.log(
          chalk.gray("─────────────────────────────────────────────\n")
        );
      } else if (connection === "connecting") {
        console.log("🔄 Connecting to WhatsApp...");
      }
    });

    return sock;
  } catch (error) {
    botLogger.error("Error initializing bot:", error);
    throw error;
  }
}
