import { downloadMediaMessage } from "naruyaizumi";
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
import { text } from "stream/consumers";
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

  // Perbaikan untuk command YTV yang lebih robust untuk button response
  registry.addGlobalCommand({
    name: "ytv",
    description: "Download video YouTube",
    usage: `${registry.prefix}ytv <url>`,
    category: "utils",
    isowner: true,
    exec: async ({ sock, args, messageInfo, reply }) => {
      try {
        // Enhanced argument parsing untuk button response
        let url = args[0];

        // Jika tidak ada args, coba ambil dari button data
        if (
          !url &&
          messageInfo.isButtonResponse &&
          messageInfo.buttonData?.buttonId
        ) {
          const buttonCommand = messageInfo.buttonData.buttonId;
          console.log("🔘 Processing button command:", buttonCommand);

          // Extract URL dari button command (format: ".ytv https://youtube.com/...")
          const parts = buttonCommand.split(" ");
          if (parts.length > 1) {
            url = parts.slice(1).join(" "); // Join kembali jika URL ada spasi
          }
        }

        if (!url) {
          return await reply("❗ Masukkan URL YouTube! Contoh: !ytv <url>");
        }

        // Log untuk debugging
        console.log("🎥 YTV Command executed:");
        console.log("- URL:", url);
        console.log("- Is Button Response:", messageInfo.isButtonResponse);
        console.log("- Button Data:", messageInfo.buttonData);

        // Validasi URL YouTube
        const youtubeRegex =
          /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
        if (!youtubeRegex.test(url)) {
          return await reply(
            "❌ URL tidak valid! Masukkan URL YouTube yang benar."
          );
        }

        // Kirim feedback immediate untuk button response
        if (messageInfo.isButtonResponse) {
          await reply(
            `🎬 Memproses download video dari button: "${
              messageInfo.buttonData?.displayText || "Video Download"
            }"\n📹 URL: ${url}\n⏳ Mohon tunggu...`
          );
        } else {
          await reply("⏳ Memproses download video, mohon tunggu...");
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
          playlist: videoInfo.playlist,
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
        console.log("🖼️ Thumbnails after download:", filesAfterThumbs);

        // Find the new file(s)
        const newFiles = filesAfter.filter((f) => !filesBefore.includes(f));
        console.log("🆕 New files found:", newFiles);

        const newFilesThumbs = filesAfterThumbs.filter(
          (f) => !filesBeforeThumbs.includes(f)
        );
        console.log("🆕 New thumbnail files found:", newFilesThumbs);

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

        const downloadedPathThumbs = path.join(
          outputDirthumbnail,
          thumbnailFile
        );

        // Pastikan file thumbnail ada
        if (!fs.existsSync(downloadedPathThumbs)) {
          console.warn(
            "⚠️ Thumbnail tidak ditemukan, melanjutkan tanpa thumbnail"
          );
        }

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

        const names = messageInfo.raw.pushName || "User";

        // Enhanced caption untuk button response
        let caption;
        if (messageInfo.isButtonResponse) {
          caption = `🎬 *Video Download Selesai!* 

👋 Hai! ${names}
🔘 Button: ${messageInfo.buttonData?.displayText || "Download Video"}

📝 *Judul:* ${fileInfo.title}
📽️ *Kualitas:* ${fileInfo.format_note}
⏱️ *Durasi:* ${formattedDuration}
📦 *Ukuran:* ${fileInfo.fileSize}

> By Natz6N ~ Oblivinx Bot
> Download via Button Response ✅`;
        } else {
          caption = `👋 Hai! ${names}

📝 *Judul:* ${fileInfo.title}
📽️ *Kualitas:* ${fileInfo.format_note}
⏱️ *Durasi:* ${formattedDuration}
📦 *Ukuran:* ${fileInfo.fileSize}

> By Natz6N ~ Oblivinx Bot`;
        }

        console.log("📝 Caption:", caption);

        // ✅ STEP 8: Send video
        console.log("📤 Sending video...");
        const playlistInfo = videoInfo.playlist || null;
        console.log("📋 Playlist info:", playlistInfo);

        await sock.sendMessage(messageInfo.sender, {
          text: `📤 Sedang mengirim video... Mohon bersabar!`,
        });

        await sock.sendMessage(
          messageInfo.sender,
          {
            video: fs.readFileSync(downloadedPath),
            caption,
            mimetype: "video/mp4",
            fileLength: fileStats.size,
          },
          { quoted: messageInfo.raw }
        );
        console.log("✅ Video sent successfully");

        // ✅ STEP 9: Cleanup - delete file after sending
        try {
          await fileManager.deleteFile(downloadedPath);
          if (fs.existsSync(downloadedPathThumbs)) {
            await fileManager.deleteFile(downloadedPathThumbs);
          }
          console.log("🗑️ Files cleaned up successfully");
        } catch (deleteError) {
          console.warn("⚠️ Failed to delete files:", deleteError.message);
        }
      } catch (error) {
        console.error("❌ YTV Command Error:");
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);

        botLogger.error("❌ Error di command ytv:", error);

        // Enhanced error message
        let errorMessage = "❌ Terjadi kesalahan saat download video.";

        if (messageInfo.isButtonResponse) {
          errorMessage = `❌ Gagal download video dari button "${
            messageInfo.buttonData?.displayText || "Video Download"
          }"`;
        }

        if (error.message.includes("not found")) {
          errorMessage += "\n🔍 File tidak ditemukan setelah download.";
        } else if (error.message.includes("Failed to get")) {
          errorMessage += "\n🌐 Gagal mendapatkan informasi video.";
        } else if (error.message.includes("yt-dlp failed")) {
          errorMessage += "\n⚙️ Proses download gagal.";
        } else if (error.message.includes("tidak valid")) {
          errorMessage += "\n🔗 URL YouTube tidak valid.";
        }

        errorMessage += `\n\n📝 Detail: ${error.message}`;

        await reply(errorMessage);
      }
    },
  });
  /* 
  Youtube To Audio
  */
  registry.addGlobalCommand({
    name: "yta",
    description: "Download audio YouTube",
    usage: `${registry.prefix}yta <url>`,
    category: "utils",
    isowner: true,
    exec: async ({ sock, args, messageInfo, reply }) => {
      try {
        const url = args[0];
        // Jika tidak ada args, coba ambil dari button data
        if (
          !url &&
          messageInfo.isButtonResponse &&
          messageInfo.buttonData?.buttonId
        ) {
          const buttonCommand = messageInfo.buttonData.buttonId;
          console.log("🔘 Processing button command:", buttonCommand);

          // Extract URL dari button command (format: ".ytv https://youtube.com/...")
          const parts = buttonCommand.split(" ");
          if (parts.length > 1) {
            url = parts.slice(1).join(" "); // Join kembali jika URL ada spasi
          }
        }
        if (!url) {
          return await reply("❗ Masukkan URL YouTube! Contoh: !yta <url>");
        }

        const hash = createHash("sha256")
          .update(url)
          .digest("hex")
          .slice(0, 10);
        const fileNameBase = `yta_Oblivinx__${hash}`;
        const fileTemplate = `${fileNameBase}__%(id)s.%(ext)s`;

        const outputDir = fileManager.getDirectoryPath("audio");

        fs.mkdirSync(outputDir, { recursive: true });

        // Ambil info video
        const videoInfo = await ytdl.getInfo(url);

        // Simpan file sebelum download
        const filesBefore = fs.existsSync(outputDir)
          ? fs.readdirSync(outputDir).filter((f) => f.startsWith(fileNameBase))
          : [];

        // Mulai download audio
        const downloadResult = await ytdl.downloadAudio(url, {
          outputDir,
          outputTemplate: fileTemplate,
          onProgress: (p) => console.log("📊 Audio Progress:", p.trim()),
        });

        console.log(downloadResult);
        const filesAfter = fs
          .readdirSync(outputDir)
          .filter((f) => f.startsWith(fileNameBase));
        console.log("📂 Files after download:", filesAfter);

        const newFiles = filesAfter.filter((f) => !filesBefore.includes(f));
        console.log("🆕 New files found:", newFiles);

        if (newFiles.length === 0)
          throw new Error("❌ Audio tidak ditemukan setelah proses download");

        let downloadedFileName = newFiles[0];
        if (newFiles.length > 1) {
          const audio = newFiles.filter((f) =>
            /\.(mp3|wav|ogg|flac|aac|m4a)$/i.test(f)
          );
          if (audio.length > 0) {
            downloadedFileName = audio[0];
          }
        }
        const downloadedPath = path.join(outputDir, downloadedFileName);

        if (!fs.existsSync(downloadedPath))
          throw new Error(`❌ File tidak ditemukan: ${downloadedPath}`);

        const fileStats = fs.statSync(downloadedPath);
        const fileInfo = {
          title: videoInfo.title,
          duration: formatDuration(videoInfo.duration),
          size: `${(fileStats.size / 1024 / 1024).toFixed(2)} MB`,
          fileName: downloadedFileName,
        };

        const names = messageInfo.raw.pushName;
        const caption = `🎧 *Audio Downloader* by Oblivinx

👤 Nama: *${names}*
🎵 Judul: *${fileInfo.title}*
⏱️ Durasi: *${fileInfo.duration}*
📦 Ukuran: *${fileInfo.size}*

🔗 ${url}
`;
        // 1. Kirim audionya dulu
        const { key, message } = await sock.sendMessage(
          messageInfo.sender,
          {
            audio: fs.readFileSync(downloadedPath),
            mimetype: "audio/mp4",
            ptt: false,
          },
          { quoted: messageInfo.raw }
        );

        // 2. Kirim caption-nya terpisah
        await sock.sendMessage(
          messageInfo.sender,
          { text: caption },
          {
            quoted: {
              message,
              key,
            },
          }
        );

        // Cleanup
        await fileManager.deleteFile(downloadedPath);
        console.log("🧹 Audio dan thumbnail dibersihkan.");
      } catch (error) {
        console.error("❌ Error YTA:", error.message);
        await reply(`❌ Terjadi kesalahan:\n${error.message}`);
      }
    },
  });
  registry.addGlobalCommand({
    name: "ytinfo",
    description: "Lihat informasi video YouTube dan pilih unduhan",
    usage: `${registry.prefix}ytinfo <url>`,
    category: "utils",
    isowner: true,
    exec: async ({ sock, args, messageInfo, reply }) => {
      try {
        const url = args[0];
        // Jika tidak ada args, coba ambil dari button data
        if (
          !url &&
          messageInfo.isButtonResponse &&
          messageInfo.buttonData?.buttonId
        ) {
          const buttonCommand = messageInfo.buttonData.buttonId;
          console.log("🔘 Processing button command:", buttonCommand);

          // Extract URL dari button command (format: ".ytv https://youtube.com/...")
          const parts = buttonCommand.split(" ");
          if (parts.length > 1) {
            url = parts.slice(1).join(" "); // Join kembali jika URL ada spasi
          }
        }
        if (!url) {
          return await reply("❗ Masukkan URL YouTube!\nContoh: !ytinfo <url>");
        }

        // Ambil info video
        const videoInfo = await ytdl.getInfo(url);
        // Destructure info dengan fallback
        const {
          uploader_id,
          uploader_url,
          like_count,
          description,
          fulltitle,
          channel_is_verified,
          subtitles,
          comment_count,
          categories,
          tags,
          availability,
          duration_string,
        } = videoInfo;

        const caption = `🎧 *YouTube Info* by Oblivinx

📝 *Judul:* ${fulltitle}
👤 *Channel:* ${uploader_id || "Tidak diketahui"} ${
          channel_is_verified ? "✅ Terverifikasi" : ""
        }
🔗 *Channel URL:* ${uploader_url || "-"}
👍 *Likes:* ${like_count ?? "Tidak diketahui"}
💬 *Komentar:* ${comment_count ?? "Tidak diketahui"}
🎬 *Durasi:* ${duration_string ?? "-"}
🏷️ *Kategori:* ${(categories || []).join(", ") || "-"}
🏷️ *Tags:* ${(tags || []).slice(0, 5).join(", ") || "-"}
🌍 *Ketersediaan:* ${availability || "-"}

🧾 *Deskripsi:*
${description?.slice(0, 300) || "Tidak ada deskripsi..."}`;

        // Kirim caption + tombol
        const {message} = await sock.sendMessage(
          messageInfo.sender,
          {
            text: caption,
            footer: "🎬 Pilih opsi unduhan di bawah",
            buttons: [
              {
                buttonId: `${registry.prefix}yta ${url}`,
                buttonText: { displayText: "🎵 Download Audio" },
                type: 1,
              },
              {
                buttonId: `${registry.prefix}ytv ${url}`,
                buttonText: { displayText: "📽️ Download Video" },
                type: 1,
              },
              {
                buttonId: `${registry.prefix}ytpl ${url}`,
                buttonText: { displayText: "📺 Lihat Playlist" },
                type: 1,
              },
              {
                buttonId: `${registry.prefix}joinwa`,
                buttonText: { displayText: "👥 Join Grup WA" },
                type: 1,
              },
            ],
            headerType: 1,
          },
          { quoted: messageInfo.raw }
        );
        console.log(message)
      } catch (error) {
        console.error("❌ Error YTINFO:", error);
        await reply(
          `❌ Terjadi kesalahan saat mengambil informasi:\n${error.message}`
        );
      }
    },
  });

  botLogger.info("✅ Example commands loaded successfully");
}
