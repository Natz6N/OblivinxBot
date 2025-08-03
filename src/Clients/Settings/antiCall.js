import config from "../../config.js";

export function setupAntiCall(sock, db, logger) {
  sock.ev.on("call", async (callData) => {
    for (const call of callData) {
      if (call.status !== "offer") continue;

      const caller = call.from.replace(/[^0-9]/g, "");

      // Skip jika owner
      const userData = config.userDB.get(`users.${caller}`, {});
      const isPremium = userData.ispremium?.status || false;
      if ((await config.isOwner(caller)) || isPremium) {
        logger.info(
          `⏩ Panggilan dari owner atau dari premium user ${caller} diabaikan.`
        );
        return;
      }

      const callKey = `calls.${caller}`;

      // Ambil data call sebelumnya
      const current = db.get(callKey, {
        count: 0,
        lastCall: 0,
        blocked: false,
      });

      const updatedCount = current.count + 1;
      const now = Date.now();

      // Simpan ke callDB
      await db.set(callKey, {
        count: updatedCount,
        lastCall: now,
        blocked: false, // belum diblok sampai count >= 3
      });

      logger.warn(`📞 Panggilan ke-${updatedCount} dari ${caller}`);

      // Kirim peringatan ke user
      const warningMsg =
        updatedCount < 3
          ? `⚠️ Jangan melakukan panggilan ke bot.\nKesempatan tersisa: ${
              3 - updatedCount
            }`
          : `🚫 Kamu telah melakukan panggilan lebih dari 3x.\nBot akan memblokirmu otomatis.`;

      await sock.sendMessage(call.from, {
        text: warningMsg,
      });

      // Jika sudah mencapai 3x, blokir & update userDB
      if (updatedCount >= 3) {
        await sock.updateBlockStatus(call.from, "block");
        logger.info(`🔒 ${caller} telah diblokir setelah 3x call.`);

        const now = Date.now();
        const userKey = `users.${caller}`;
        const userData = config.userDB.get(userKey, {});

        // Inisialisasi block_history jika belum ada
        const blockHistory = Array.isArray(userData.block_history)
          ? userData.block_history
          : [];

        blockHistory.push({
          blocked_at: now,
          reason: "Blokir otomatis karena call 3x",
          unblocked_at: null,
        });

        const updatedUserData = {
          ...userData,
          blocked: true,
          block_history: blockHistory,
          updateAt: now,
        };

        await config.userDB.set(userKey, updatedUserData);
        logger.info(`📁 Status user ${caller} diperbarui ke blocked.`);

        // Hapus data call setelah blokir
        await db.delete(callKey);
        logger.info(`🧹 Data call untuk ${caller} dihapus dari callDB.`);
      }
    }
  });
}
