import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { botLogger } from "../bot.js";
import config from "../config.js";
import FormData from "form-data";
import fetch from "node-fetch";
import path from "path";
import fs from "fs";

import { YtDlp } from "../libs/ytdl-wrap.js";
import { createHash } from "crypto";
import fileManager from "../FileManagers/FileManager.js";
import { writeExifImg, writeExifVid, writeExifWebp } from "../libs/exec.js";
const ytdl = new YtDlp();
/**
 * global commands to the MessageRegistry
 * @param {MessageRegistry} registry - The command registry instance
 */
function formatDuration(seconds) {
  if (isNaN(seconds) || seconds <= 0) return "00:00";

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const pad = (num) => String(num).padStart(2, "0");

  return hrs > 0
    ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}`
    : `${pad(mins)}:${pad(secs)}`;
}

export default function (registry) {
  // Setting Languages
  registry.addGlobalCommand({
    name: "lang",
    aliases: ["setlang", "language"],
    description: "Mengubah bahasa yang diinginkan",
    usage: "/lang <kode_bahasa>",
    category: "settings",
    cooldown: 2,
    exec: async ({ args, reply, messageInfo }) => {
      const userKey = messageInfo.sender;
      if (args.length === 0) {
        return await reply(
          config.getLang(userKey).response.responseFeature.lang.idLang
        );
      }

      const selectedLang = args[0].toUpperCase();
      const supportedLangs = ["ID", "EN", "JP"]; // Tambahkan sesuai kebutuhan
      const languages = supportedLangs.join(", ");

      if (!supportedLangs.includes(selectedLang)) {
        return await reply(
          config
            .getLang(userKey)
            .response.responseFeature.lang.BahasaTersedia.replace(
              "${Language}",
              languages
            )
        );
      }

      // Simpan ke database
      const userData = config.userDB.get(userKey, {});
      userData.lang = selectedLang;
      config.userDB.set(userKey, userData);
      const success = config
        .getLang(userKey)
        .response.responseFeature.lang.success.replace(
          "${selected}",
          selectedLang
        );

      await reply(success);
    },
  });

  // upscaling
  registry.addGlobalCommand({
    name: "upscale",
    aliases: ["hdimg", "hd", "waifu2x"],
    description: "Upscaling gambar dengan AI (resolusi 2x)",
    usage: "/hd",
    category: "img",
    cooldown: 2,

    exec: async ({ sock, reply, messageInfo }) => {
      try {
        // console.log("remoteJid:", messageInfo.remoteJid);
        const { message, sender } = messageInfo;
        const quotedMsg =
          message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const imageMsg = quotedMsg?.imageMessage || message.imageMessage;

        if (
          !imageMsg ||
          !imageMsg.mimetype ||
          !/image\/(jpe?g|png)/i.test(imageMsg.mimetype)
        ) {
          return reply(
            "❌ Kirim atau balas gambar (JPG/PNG) dengan perintah ini."
          );
        }

        const mediaMsg = quotedMsg
          ? { message: { imageMessage: quotedMsg.imageMessage } }
          : { message };

        const buffer = await downloadMediaMessage(
          mediaMsg,
          "buffer",
          {},
          { logger: botLogger }
        );

        if (!buffer) return reply("❌ Gagal mendownload gambar.");

        const mime = imageMsg.mimetype;
        const ext = mime.split("/")[1];
        const filename = `upscaled_${Date.now()}.${ext}`;

        const form = new FormData();
        form.append("image", buffer, { filename, contentType: mime });
        form.append("scale", "2");

        const headers = {
          ...form.getHeaders(),
          accept: "application/json",
          "x-client-version": "web",
          "x-locale": "es",
        };

        const res = await fetch("https://api2.pixelcut.app/image/upscale/v1", {
          method: "POST",
          headers,
          body: form,
        });

        if (!res.ok) {
          const text = await res.text();
          return reply(`❌ Gagal upscale gambar: ${res.status} - ${text}`);
        }

        const json = await res.json();

        if (!json?.result_url) {
          return reply("❌ Gagal mendapatkan gambar hasil dari Pixelcut.");
        }

        const response = await fetch(json.result_url);
        const arrayBuffer = await response.arrayBuffer();
        const resultBuffer = Buffer.from(arrayBuffer);

        await sock.sendMessage(
          sender,
          {
            image: resultBuffer,
            caption: `✅ Upscaling berhasil! Gambar telah ditingkatkan 2x resolusinya.`,
          },
          { quoted: messageInfo.raw }
        );
      } catch (err) {
        console.log(err);
        return reply(
          `❌ Terjadi kesalahan saat proses upscaling:\n${err.message}`
        );
      }
    },
  });

  // Sticker
  registry.addGlobalCommand({
    name: "sticker",
    aliases: ["s", "stiker"],
    description: "Mengubah media menjadi stiker",
    usage: `kamu harus mengirim gambar dan command ini atau bisa dengan reply ${registry.prefix}sticker`,
    category: "img",
    cooldown: 2,
    exec: async ({ reply, messageInfo, sock }) => {
      try {
        const { message } = messageInfo;
        let mediaMsg = { message };

        const quotedMsg =
          message?.extendedTextMessage?.contextInfo?.quotedMessage;

        const isImage = message.imageMessage || quotedMsg?.imageMessage;
        const isVideo = message.videoMessage || quotedMsg?.videoMessage;
        const isGif =
          message.videoMessage?.gifPlayback ||
          quotedMsg?.videoMessage?.gifPlayback;
        const isWebP =
          message.documentMessage?.mimetype === "image/webp" ||
          quotedMsg?.documentMessage?.mimetype === "image/webp";
        const isSticker = quotedMsg?.stickerMessage;

        const hasValidMedia =
          isImage || isVideo || isGif || isWebP || isSticker;

        if (!hasValidMedia) {
          return reply(
            "❌ Kirim/reply gambar/video/GIF/WebP dengan caption !sticker"
          );
        }

        await reply("⏳ Sedang membuat sticker...");

        // Jika reply, gunakan media dari quoted message
        if (quotedMsg) {
          mediaMsg = { message: quotedMsg };
        }

        // Nama pack default
        const metadata = {
          packname: "NatzsixnPacks",
          author: "OrbitStudio",
          categories: ["🤖"],
        };

        // Download media
        const buffer = await downloadMediaMessage(
          mediaMsg,
          "buffer",
          {},
          { logger: botLogger }
        );

        if (!buffer || !Buffer.isBuffer(buffer)) {
          throw new Error("Gagal mendownload media: buffer tidak valid");
        }

        let stickerBuffer;

        if (isWebP) {
          stickerBuffer = await writeExifWebp(buffer, metadata);
        } else {
          const ext = isImage ? "jpg" : isGif ? "gif" : "mp4";
          const originalName = `sticker_input.${ext}`;
          const savedFile = await fileManager.saveFile(
            buffer,
            originalName,
            "stickers"
          );

          if (!savedFile.success) {
            throw new Error("Gagal menyimpan file: " + savedFile.error);
          }

          if (isImage) {
            stickerBuffer = await writeExifImg(buffer, metadata);
          } else if (isGif || isVideo) {
            stickerBuffer = await writeExifVid(buffer, metadata);
          }

          await fileManager.deleteFile(savedFile.path);
        }

        if (!stickerBuffer || !Buffer.isBuffer(stickerBuffer)) {
          throw new Error("Gagal membuat sticker: buffer sticker tidak valid");
        }

        // Kirim sticker yang benar
        await sock.sendMessage(
          messageInfo.sender,
          {
            sticker: stickerBuffer,
          },
          { quoted: messageInfo.raw }
        );
      } catch (error) {
        botLogger.error("Error membuat sticker:", error);
        console.log(error);
        await reply("❌ Gagal membuat sticker: " + error.message);
      }
    },
  });

  registry.addGlobalCommand({
    name: "ytv",
    description: "Download video YouTube",
    usage: `${registry.prefix}ytv <url>`,
    category: "utils",
    isowner: true,
    exec: async ({ sock, args, messageInfo, reply }) => {
      try {
        const url = args[0];
        if (!url) {
          return await reply("❗ Masukkan URL YouTube! Contoh: !ytv <url>");
        }

        // Hash URL → nama unik
        const hash = createHash("sha256")
          .update(url)
          .digest("hex")
          .slice(0, 10);
        const fileNameBase = `ytv_Oblivinx__${hash}`;
        const fileTemplate = `${fileNameBase}__%(id)s.%(ext)s`;

        const outputDirthumbnail = fileManager.getDirectoryPath("images");
        const outputDir = fileManager.getDirectoryPath("video");

        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
          console.log("✅ Folder video dibuat.");
        }

        console.log("📁 OutputDir:", outputDir);
        console.log("📄 OutputTemplate:", fileTemplate);

        // ✅ STEP 1: Get video info first
        console.log("🔍 Getting video information...");

        const videoInfo = await ytdl.getInfo(url);
        console.log("📋 Video Info:", {
          id: videoInfo.id,
          title: videoInfo.title,
          duration: videoInfo.duration,
          ext: videoInfo.ext,
        });

        // ✅ STEP 2: List files before download untuk comparison
        const filesBefore = fs.existsSync(outputDir)
          ? fs.readdirSync(outputDir).filter((f) => f.startsWith(fileNameBase))
          : [];

        const filesBeforeThumbs = fs.existsSync(outputDirthumbnail)
          ? fs
              .readdirSync(outputDirthumbnail)
              .filter((f) => f.startsWith(fileNameBase))
          : [];
        console.log("📂 Files before download:", filesBefore);

        // ✅ STEP 3: Download video
        console.log("⬇️ Starting download...");
        const downloadResult = await ytdl.downloadVideo(url, "720", {
          outputDir,
          outputTemplate: fileTemplate,
          onProgress: (progress) => {
            console.log("📊 Download progress:", progress.trim());
          },
        });
        const Thumbnailsget = await ytdl.getThumbnail(url, {
          outputDir: outputDirthumbnail,
          outputTemplate: fileTemplate,
        });
        console.log("✅ Download completed:", downloadResult);
        console.log("✅ Download thumbnail:", Thumbnailsget);

        // ✅ STEP 4: List files after download dan find new file
        const filesAfter = fs
          .readdirSync(outputDir)
          .filter((f) => f.startsWith(fileNameBase));
        console.log("📂 Files after download:", filesAfter);

        const filesAfterThumbs = fs
          .readdirSync(outputDirthumbnail)
          .filter((f) => f.startsWith(fileNameBase));
        console.log("📂 Files after download:", filesAfter);

        // Find the new file(s)
        const newFiles = filesAfter.filter((f) => !filesBefore.includes(f));
        console.log("🆕 New files found:", newFiles);

        const newFilesThumbs = filesAfterThumbs.filter(
          (f) => !filesBeforeThumbs.includes(f)
        );
        console.log("🆕 New files found:", newFilesThumbs);

        if (newFiles.length === 0) {
          // Fallback: look for any file that matches pattern
          const patternFiles = filesAfter.filter(
            (f) => f.includes(videoInfo.id) || f.startsWith(fileNameBase)
          );
          console.log("🔍 Pattern-matched files:", patternFiles);

          if (patternFiles.length === 0) {
            throw new Error("Tidak ada file yang ditemukan setelah download");
          }
          newFiles.push(...patternFiles);
        }

        // Get the downloaded file (usually the first/largest one)
        let downloadedFileName = newFiles[0];

        // If multiple files, prefer video files over others
        if (newFiles.length > 1) {
          const videoFiles = newFiles.filter((f) =>
            /\.(mp4|mkv|webm|avi|mov)$/i.test(f)
          );
          if (videoFiles.length > 0) {
            downloadedFileName = videoFiles[0];
          }
        }

        const downloadedPath = path.join(outputDir, downloadedFileName);
        console.log("📍 Final downloaded path:", downloadedPath);

        // ✅ STEP 5: Verify file exists and get stats
        if (!fs.existsSync(downloadedPath)) {
          console.error("❌ File verification failed:");
          console.error("Expected path:", downloadedPath);
          console.error("Directory contents:", fs.readdirSync(outputDir));
          throw new Error(`File tidak ditemukan: ${downloadedPath}`);
        }
        let thumbnailFile = newFilesThumbs.find((f) =>
          /\.(jpe?g|png|webp)$/i.test(f)
        );

        // if (!thumbnailFile) {
        //   throw new Error("Thumbnail tidak ditemukan setelah download");
        // }

        const downloadedPathThumbs = path.join(
          outputDirthumbnail,
          thumbnailFile
        );

        // Pastikan file thumbnail ada
        if (!fs.existsSync(downloadedPathThumbs)) {
          throw new Error("Thumbnail tidak ditemukan");
        }

        const jpegThumbnail = fs.readFileSync(downloadedPathThumbs);
        const fileStats = fs.statSync(downloadedPath);
        console.log("📊 File stats:", {
          size: `${(fileStats.size / 1024 / 1024).toFixed(2)} MB`,
          created: fileStats.birthtime,
        });

        // ✅ STEP 6: Extract additional info from filename if needed
        const fileInfo = {
          title: videoInfo.title || "Tanpa Judul",
          duration: videoInfo.duration || 0,
          format_note: videoInfo.format_note || "720p",
          fileSize: `${(fileStats.size / 1024 / 1024).toFixed(2)} MB`,
          fileName: downloadedFileName,
        };

        // ✅ STEP 7: Format caption
        const formattedDuration = formatDuration(fileInfo.duration);

        const names = messageInfo.raw.pushName;
        const caption = ` Hi ${names} Ini videomu

🎬 *Judul:* ${fileInfo.title}
📽️ *Kualitas:* ${fileInfo.format_note}
⏱️ *Durasi:* ${formattedDuration}
📦 *Ukuran:* ${fileInfo.fileSize}

> By Natz6N ~ Oblivinx Bot
`;
        console.log("📝 Caption:", caption);

        // ✅ STEP 8: Send video
        console.log("📤 Sending video...");
        const { key, message } = await sock.sendMessage(
          messageInfo.sender,
          {
            document: fs.readFileSync(downloadedPath), // buffer video
            caption,
            mimetype: "video/mp4",
            jpegThumbnail,
            fileLength: fileStats.size,
            footer: "By Oblivinx Bot",
            headerType: 4,
            contextInfo: {
              externalAdReply: {
                title: fileInfo.title,
                body: "Klik untuk nonton di YouTube",
                mediaType: 2,
                thumbnail: jpegThumbnail,
                mediaUrl: url,
                sourceUrl: url,
              },
            },
          },
          { quoted: messageInfo.raw }
        );

        // ✅ Pesan kedua: tombol saja
        // ✅ Pesan kedua: tombol saja (fixed)
        await sock.sendMessage(
          messageInfo.sender,
          {
            text: "📌 Pilih menu lanjutan:",
            footer: "By Oblivinx Bot",
            buttons: [
              {
                buttonId: `${registry.prefix}help`,
                buttonText: { displayText: "📖 Help" },
                type: 1,
              },
              {
                buttonId: `${registry.prefix}menu`,
                buttonText: { displayText: "📂 Menu" },
                type: 1,
              },
            ],
          },
          {
            quoted: {
              key,
              message,
            },
          }
        );
        console.log("✅ Video sent successfully");

        // ✅ STEP 9: Cleanup - delete file after sending
        try {
          await fileManager.deleteFile(downloadedPath);
          await fileManager.deleteFile(downloadedPathThumbs);
          console.log("🗑️ File deleted successfully");
        } catch (deleteError) {
          console.warn("⚠️ Failed to delete file:", deleteError.message);
        }
      } catch (error) {
        console.error("❌ YTV Command Error:");
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);

        botLogger.error("❌ Error di command ytv:", error);

        // Enhanced error message
        let errorMessage = "❌ Terjadi kesalahan saat download video.";

        if (error.message.includes("not found")) {
          errorMessage += "\n🔍 File tidak ditemukan setelah download.";
        } else if (error.message.includes("Failed to get")) {
          errorMessage += "\n🌐 Gagal mendapatkan informasi video.";
        } else if (error.message.includes("yt-dlp failed")) {
          errorMessage += "\n⚙️ Proses download gagal.";
        }

        errorMessage += `\n\n📝 Detail: ${error.message}`;

        await reply(errorMessage);
      }
    },
  });

  botLogger.info("✅ Example commands loaded successfully");
}
