import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  isJidNewsletter,
} from "@whiskeysockets/baileys";
import Pino from "pino";
import qrcode from "qrcode-terminal";
import * as Boom from "@hapi/boom";

const groupCache = new Map();
const doReplies = true;

async function sendMessageWTyping(message, jid, sock) {
  await sock.presenceSubscribe(jid);
  await delay(500);
  await sock.sendPresenceUpdate("composing", jid);
  await delay(1000);
  await sock.sendPresenceUpdate("paused", jid);
  await sock.sendMessage(jid, message);
}

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

export default async function initBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    logger: Pino({ level: "silent" }),
    browser: ["Oblivinx Bot", "Chrome", "1.0.0"],
    cachedGroupMetadata: async (jid) => groupCache.get(jid),
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("groups.update", async ([event]) => {
    const metadata = await sock.groupMetadata(event.id);
    groupCache.set(event.id, metadata);
  });

  sock.ev.on("group-participants.update", async (event) => {
    const metadata = await sock.groupMetadata(event.id);
    groupCache.set(event.id, metadata);
  });

  sock.ev.on("messages.upsert", async (event) => {
    if (event.type === "notify") {
      for (const msg of event.messages) {
        if (
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text
        ) {
          const text =
            msg.message?.conversation || msg.message?.extendedTextMessage?.text;

          if (text === "requestPlaceholder") {
            const messageId = await sock.requestPlaceholderResend(msg.key);
            console.log("Requested placeholder resync, id =", messageId);
          }

          if (text === "onDemandHistSync") {
            const messageId = await sock.fetchMessageHistory(
              50,
              msg.key,
              msg.messageTimestamp
            );
            console.log("Requested on-demand sync, id =", messageId);
          }

          if (
            !msg.key.fromMe &&
            doReplies &&
            !isJidNewsletter(msg.key?.remoteJid)
          ) {
            console.log("Replying to", msg.key.remoteJid);
            await sock.readMessages([msg.key]);
            await sendMessageWTyping(
              { text: "Hello there!" },
              msg.key.remoteJid,
              sock
            );
          }
        }
      }
    }
  });
  sock.on("qr", async (qr) => {
    // NOTE: This event will not be fired if a session is specified.
    console.log("QR RECEIVED", qr);

    // paiuting code example
    const pairingCodeEnabled = false;
    if (pairingCodeEnabled && !pairingCodeRequested) {
      const pairingCode = await client.requestPairingCode("96170100100" ); // enter the target phone number
      console.log("Pairing code enabled, code: " + pairingCode);
      pairingCodeRequested = true;
    }
  });
  sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
    
    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error instanceof Boom.Boom &&
        lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect) {
        console.log("Reconnecting...");
        await initBot();
      } else {
        console.log("Logged out.");
      }
    }
  });
}
