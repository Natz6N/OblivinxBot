// bot.js - Main bot initialization file
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  isJidNewsletter,
} from "naruyaizumi";
import Pino from "pino";
import qrcode from "qrcode-terminal";
import * as Boom from "@hapi/boom";
import { MessageRegistry } from "./Clients/RegistryCommands.js";
import {
  createMessageHandler,
  processMessageFromQueue,
  delay,
} from "./Clients/messageClients.js";
import { handleIncomingMessage } from "./Clients/messageClients.js";
import os from "os";
import { setupAntiCall } from "./Clients/Settings/antiCall.js";
import config from "./config.js";
import dayjs from "dayjs";
import {
  generateGoodbyeCard,
  generateWelcomeCard,
} from "./Clients/groupHandle.js";

import path from "path";
import { fileURLToPath } from "url";
const groupCache = new Map();
let pairingCodeRequested = false;
let globalQueue = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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

    // Store queue reference globally for reconnection
    if (queue) {
      globalQueue = queue;
    }

    // Use global queue if no queue parameter provided (during reconnection)
    const currentQueue = queue || globalQueue;

    if (!currentQueue) {
      throw new Error("Queue is required for bot initialization");
    }

    const { state, saveCreds } = await useMultiFileAuthState("__oblivinx_auth");

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      logger: Pino({ level: "silent" }),
      browser: ["OblivinxBot", "Chrome", "110.0.5481.77"],
      cachedGroupMetadata: async (jid) => groupCache.get(jid),
      // Add these connection options to improve stability
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 10000,
      markOnlineOnConnect: true,
      syncFullHistory: false,
      // Add user agent and other headers
      options: {
        headers: {
          "User-Agent":
            "WhatsApp/2.23.24.76 Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
        },
      },
    });

    const registry = new MessageRegistry(sock, botLogger);
    const owners = config.ownerDB.get("owners", []) || [];
    registry.setPrefix(config.prefix).setOwners(owners);

    currentQueue.setDefaultHandler(processMessageFromQueue);

    // Handle credentials update
    sock.ev.on("creds.update", saveCreds);
    setupAntiCall(sock, config.callDB, botLogger);
    
    sock.ev.on("group-participants.update", async (update) => {
      const { id: groupId, participants, action } = update;
      console.log(update);
      try {
        const metadata = await sock.groupMetadata(groupId);
        const groupName = metadata.subject;

        console.log(
          `[Bot] Group participants update in ${groupName}: ${action}`
        );

        const defaults = path.join(__dirname, "./src/media/images.jpg");

        for (const participant of participants) {
          try {
            // Ambil foto profil
            let profilePicture;
            try {
              profilePicture = await sock.profilePictureUrl(
                participant,
                "image"
              );
            } catch {
              profilePicture = defaults;
              console.log(`[Bot] No profile picture for ${participant}`);
            }

            // Ambil nama pengguna
            let userName = participant.split("@")[0]; // default
            try {
              const participant = metadata.participants.find(
                (p) => p.id === participantJid
              );
              userName =
                participant.name ||
                participant.subject ||
                participant.verifiedName ||
                `+${
                  participantJid.replace("@s.whatsapp.net", "").split("@")[0]
                }`;
            } catch {
              let userName = "User";
            }
            console.log(`[Bot] Processing ${action} for user: ${userName}`);
            try {
              const [info] = await sock.onWhatsApp(participant);
              userName =
                info?.notify || info?.name || participant.split("@")[0];
            } catch {
              userName = participant.split("@")[0];
            }

            console.log(`[Bot] Processing ${action} for user: ${userName}`);

            if (action === "add") {
              const imageBuffer = await generateWelcomeCard({
                userImageUrl: profilePicture,
                userName,
                groupName,
              });

              await sock.sendMessage(groupId, {
                image: imageBuffer,
                caption: `👋 Welcome @${
                  participant.split("@")[0]
                } to *${groupName}*!`,
                mentions: [participant],
              });

              console.log(`[Bot] Welcome card sent for ${userName}`);
            } else if (action === "remove") {
              const imageBuffer = await generateGoodbyeCard({
                userImageUrl: profilePicture,
                userName,
                groupName,
              });

              await sock.sendMessage(groupId, {
                image: imageBuffer,
                caption: `😢 @${
                  participant.split("@")[0]
                } has left *${groupName}*`,
                mentions: [participant],
              });

              console.log(`[Bot] Goodbye card sent for ${userName}`);
            }
          } catch (participantError) {
            console.error(
              `[Bot] Error processing participant ${participant}:`,
              participantError
            );

            // Fallback jika gambar gagal dibuat
            const fallbackMsg =
              action === "add"
                ? `👋 Welcome @${participant.split("@")[0]} to *${groupName}*!`
                : `😢 @${participant.split("@")[0]} has left *${groupName}*`;

            try {
              await sock.sendMessage(groupId, {
                text: fallbackMsg,
                mentions: [participant],
              });
            } catch (fallbackError) {
              console.error(`[Bot] Fallback message failed:`, fallbackError);
            }
          }
        }
      } catch (error) {
        console.error(
          `[Bot] Error in group-participants.update handler:`,
          error
        );
      }
    });

    // Create message handler with registry integration
    const messageHandler = createMessageHandler(
      sock,
      registry,
      botLogger,
      groupCache,
      currentQueue
    );

    sock.ev.on("messages.upsert", messageHandler);
    // Handle connection updates
    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;
      // Handle QR code - FIXED LOGIC
      if (qr) {
        console.log("QR RECEIVED");
        qrcode.generate(qr, { small: true });

        // Pairing code example (disabled by default)
        const pairingCodeEnabled = false;
        if (pairingCodeEnabled && !pairingCodeRequested) {
          try {
            const pairingCode = await sock.requestPairingCode("87793482662");
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

        console.log(
          "Connection closed:",
          lastDisconnect?.error?.message || "Unknown error"
        );

        // Handle specific error codes
        const statusCode = lastDisconnect?.error?.output?.statusCode;

        if (statusCode === 405) {
          console.log(
            "Method Not Allowed error - clearing session and restarting..."
          );
          // Clear auth session for 405 errors
          try {
            const fs = await import("fs");
            if (fs.existsSync("__oblivinx_auth")) {
              fs.rmSync("__oblivinx_auth", { recursive: true, force: true });
              console.log("Auth session cleared");
            }
          } catch (error) {
            console.error("Error clearing auth session:", error);
          }
          pairingCodeRequested = false;
          reconnectAttempts = 0;
        }

        if (shouldReconnect && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          console.log(
            `Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}...`
          );

          // Exponential backoff delay
          const delayMs = Math.min(
            2000 * Math.pow(2, reconnectAttempts - 1),
            30000
          );
          console.log(`Waiting ${delayMs}ms before reconnecting...`);

          await delay(delayMs);

          try {
            await initBot();
          } catch (error) {
            console.error("Error during reconnection:", error);
          }
        } else if (statusCode === DisconnectReason.loggedOut) {
          console.log("Connection logged out. Please scan QR again.");
          reconnectAttempts = 0;
          pairingCodeRequested = false;
        } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          console.log(
            "Max reconnection attempts reached. Please restart the bot manually."
          );
          reconnectAttempts = 0;
        }
      } else if (connection === "open") {
        console.log("");
        console.log("✅ Bot connected successfully!");
        botLogger.info("Bot is ready to receive messages!");
        reconnectAttempts = 0; // Reset on successful connection

        console.clear();
        console.log(`
  ____  _     _ _        _          ____        _   
 / __ \\| |   | (_)      (_)        |  _ \\      | |  
| |  | | |__ | |___  ___ _ _ __  __| |_) | ___ | |_ 
| |  | | '_ \\| | \\ \\/ / | | '_ \\/ __|  _ < / _ \\| __|
| |__| | |_) | | |>  <| | | | | \\__ \\ |_) | (_) | |_ 
 \\____/|_.__/|_|_/_/\\_\\_|_|_| |_|___/____/ \\___/ \\__|
                                                    
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
        console.log(`${chalk.cyan("👑 Owner       :")} ${owners.join(", ")}`);
        console.log(
          chalk.green.bold("\n🔥 Terima kasih sudah menggunakan bot ini!")
        );
        console.log(chalk.green.bold("📣 Jangan lupa support terus ya 💖"));
        console.log(
          chalk.gray("─────────────────────────────────────────────\n")
        );
      } else if (connection === "connecting") {
        console.log("🔄 Connecting to WhatsApp...");
      }
    });
    handleIncomingMessage(sock);
    return sock;
  } catch (error) {
    botLogger.error("Error initializing bot:", error);

    // If initialization fails, increment reconnect attempts
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      console.log(
        `Initialization failed, retrying... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`
      );
      await delay(5000);
      return await initBot(queue);
    }

    throw error;
  }
}
