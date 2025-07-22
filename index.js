import initBot from "./src/bot.js";
import MessageQueue from "./src/Clients/MessageQueue.js"; // path sesuai struktur kamu
import config from "./src/config.js";

const queue = new MessageQueue({
  maxConcurrent: 15,
  maxQueueSize: 2000,
});

// Handler command
queue.registerHandler("command", async (msg) => {
  const { registry, messageText, sock, raw } = msg;

  const messageInfo = {
    id: raw.key.id,
    sender: msg.sender,
    participant: raw.key.participant || msg.sender,
    text: messageText,
    timestamp: raw.messageTimestamp,
    isGroup: msg.isGroup,
    isAdmin: msg.isAdmin,
    messageType: "command",
    sock,
  };

  await registry.processMessage(messageInfo);
});

// Handler default
queue.setDefaultHandler(async (msg) => {
  const messageInfo = {
    id: msg.raw.key.id,
    sender: msg.sender,
    participant: msg.raw.key.participant || msg.sender,
    text: msg.messageText,
    timestamp: msg.raw.messageTimestamp,
    isGroup: msg.isGroup,
    isAdmin: msg.isAdmin,
    messageType: msg.messageType,
    sock: msg.sock,
  };

  await processMessage(messageInfo, msg.sock.botLogger || console);
});

// 3. Jalankan bot dan pass queue-nya
(async () => {
  // Inisialisasi database terlebih dahulu
  await Promise.all([
    config.callDB.init(),
    config.userDB.init(),
    config.ownerDB.init(),
  ]);

  await initBot(queue); // kirim queue ke dalam bot.js
})();
