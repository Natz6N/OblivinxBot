import JSONManager from "../../FileManagers/JSONManager";

export function setupAntiCall(sock, botLogger, options = {}) {
  const {
    autoBlock = true,
    warnMessage = "📞 Bot tidak menerima panggilan. Anda akan diblokir.",
  } = options;

  sock.ev.on("call", async (callData) => {
    for (const call of callData) {
      if (call.status === "offer") {
        const caller = call.from;

        botLogger.warn(`🚨 Panggilan terdeteksi dari: ${caller}`);

        // Kirim pesan peringatan
        if (warnMessage) {
          await sock.sendMessage(caller, { text: warnMessage });
        }

        // Blokir pemanggil jika diaktifkan
        if (autoBlock) {
          await sock.updateBlockStatus(caller, "block");
          botLogger.info(`✅ ${caller} telah diblokir karena melakukan panggilan`);
        }
      }
    }
  });
}
