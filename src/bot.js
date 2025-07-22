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
} from "./Clients/messageClients.js";

import { setupAntiCall } from "./Clients/Settings/antiCall.js";
import config from "./config.js"; 
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
    const { state, saveCreds } = await useMultiFileAuthState("__oblivinx_auth");

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      logger: Pino({ level: "silent" }),
      browser: ["Oblivinx Bot", "Chrome", "1.0.0"],
      cachedGroupMetadata: async (jid) => groupCache.get(jid),
    });

    // Initialize command registry with sock parameter

    const registry = new MessageRegistry(sock, botLogger);
    registry.setPrefix("/").setOwners(["6281910058235"]); // Replace with your phone number
    queue.setDefaultHandler(processMessageFromQueue);

    // Handle credentials update
    sock.ev.on("creds.update", saveCreds);

    await config.callDB.init();
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
      queue
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
        console.log("✅ Bot connected successfully!");
        console.log("Bot Number:", sock.user?.id);
        console.log("Bot Name:", sock.user?.name);
        botLogger.info("Bot is ready to receive messages!");
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
