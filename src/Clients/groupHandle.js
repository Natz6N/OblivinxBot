// groupHandle.js
import { createCanvas, loadImage, registerFont } from "canvas";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import https from "https";
import http from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MEDIA_PATH = path.join(__dirname, "../media");
const FONT_PATH = path.join(MEDIA_PATH, "fonts.otf");
const FONT_FAMILY = "CustomFont";
const FALLBACK_PROFILE_PATH = path.join(MEDIA_PATH, "fallback-profile.png");
const DEFAULT_WELCOME_BG_PATH = path.join(MEDIA_PATH, "bg.png");
const DEFAULT_GOODBYE_BG_PATH = path.join(MEDIA_PATH, "bg.png");

if (fs.existsSync(FONT_PATH)) {
  registerFont(FONT_PATH, { family: FONT_FAMILY });
}
if (!fs.existsSync(MEDIA_PATH)) fs.mkdirSync(MEDIA_PATH, { recursive: true });

async function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, (res) => {
      if ([301, 302].includes(res.statusCode))
        return downloadImage(res.headers.location).then(resolve);
      if (res.statusCode !== 200)
        return reject(new Error("HTTP Error: " + res.statusCode));
      const data = [];
      res.on("data", (chunk) => data.push(chunk));
      res.on("end", () => resolve(Buffer.concat(data)));
    });
    req.on("error", reject);
    req.setTimeout(10000, () => req.destroy(new Error("Timeout")));
  });
}

async function getDefaultImage(type) {
  const pathMap = {
    "welcome-bg": DEFAULT_WELCOME_BG_PATH,
    "goodbye-bg": DEFAULT_GOODBYE_BG_PATH,
    profile: FALLBACK_PROFILE_PATH,
  };
  const fallbackPath = pathMap[type] || FALLBACK_PROFILE_PATH;
  if (fs.existsSync(fallbackPath)) {
    return await loadImage(fs.readFileSync(fallbackPath));
  }
  const canvas = createCanvas(400, 400);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#666";
  ctx.beginPath();
  ctx.arc(200, 200, 200, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 180px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("👤", 200, 200);
  return await loadImage(canvas.toBuffer());
}

async function loadImageFromSource(src, type = "profile") {
  if (!src || typeof src !== "string") return getDefaultImage(type);
  try {
    const buffer = src.startsWith("http")
      ? await downloadImage(src)
      : fs.readFileSync(src);
    return await loadImage(buffer);
  } catch {
    return getDefaultImage(type);
  }
}

function drawCircularImage(ctx, image, x, y, radius) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(image, x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#fff";
  ctx.stroke();
}

function drawTextWithShadow(ctx, text, x, y, font, color = "#fff") {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  ctx.fillText(text, x, y);
  ctx.shadowColor = "transparent";
}

export async function generateWelcomeCard({
  userImageUrl,
  userName = "User",
  groupName = "Group",
  backgroundImageUrl,
}) {
  try {
    const width = 1470;
    const height = 456;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    const profileImage = await loadImageFromSource(userImageUrl, "profile");
    const logoPath = path.join(__dirname, "../media/mylogos.png");
    const logos = await loadImageFromSource(logoPath, "logo");

    const background = await loadImageFromSource(
      backgroundImageUrl || DEFAULT_WELCOME_BG_PATH,
      "welcome-bg"
    );

    // === Layer 1: gambar profile kiri (diagonal)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width * 0.28, 0);
    ctx.lineTo(width * 0.22, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(profileImage, 0, 0, width * 0.3, height);
    ctx.restore();

    // === Layer 2: gambar background (fill height, mojok kanan, rasio dijaga)
    const scale = height / background.height;
    const newBgWidth = background.width * scale;
    const offsetX = width - newBgWidth;
    ctx.drawImage(background, offsetX, 0, newBgWidth, height);
    ctx.drawImage(logos, 10, 10, 100, 120);

    // === Layer 3: teks
    const y = canvas.height - 90;
    const y2 = canvas.height - 40;
    drawTextWithShadow(ctx, "WELCOME", 400, y, "bold 80px sans-serif");

    drawTextWithShadow(
      ctx,
      `TO ${groupName.toUpperCase()}`,
      500,
      y2,
      "28px sans-serif"
    );

    // === Layer 4: profile bulat + nama kanan atas
    drawCircularImage(ctx, profileImage, width - 100, height / 2, 60);
    drawTextWithShadow(
      ctx,
      userName,
      width - 100,
      height / 2 + 90,
      `bold 28px ${fs.existsSync(FONT_PATH) ? FONT_FAMILY : "sans-serif"}`
    );

    return canvas.toBuffer("image/png");
  } catch (error) {
    console.log("generateWelcomeCard error:", error);
  }
}

export async function generateGoodbyeCard({
  userImageUrl,
  userName = "User",
  groupName = "Group",
  backgroundImageUrl,
}) {
  try {
    const width = 1470;
    const height = 456;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    const profileImage = await loadImageFromSource(userImageUrl, "profile");
    const logoPath = path.join(__dirname, "../media/mylogos.png");
    const logos = await loadImageFromSource(logoPath, "logo");

    const background = await loadImageFromSource(
      backgroundImageUrl || DEFAULT_GOODBYE_BG_PATH,
      "goodbye-bg"
    );

    // === Layer 1: gambar profile kiri (diagonal)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width * 0.28, 0);
    ctx.lineTo(width * 0.22, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(profileImage, 0, 0, width * 0.3, height);
    ctx.restore();

    // === Layer 2: gambar background (fill height, mojok kanan, rasio dijaga)
    const scale = height / background.height;
    const newBgWidth = background.width * scale;
    const offsetX = width - newBgWidth;
    ctx.drawImage(background, offsetX, 0, newBgWidth, height);
    ctx.drawImage(logos, 10, 10, 100, 120);

    // === Layer 3: teks
    const y = canvas.height - 90;
    const y2 = canvas.height - 40;
    drawTextWithShadow(ctx, "GOODBYE", 400, y, "bold 80px sans-serif");

    drawTextWithShadow(
      ctx,
      `TO ${groupName.toUpperCase()}`,
      500,
      y2,
      "28px sans-serif"
    );

    // === Layer 4: profile bulat + nama kanan atas
    drawCircularImage(ctx, profileImage, width - 100, height / 2, 60);
    drawTextWithShadow(
      ctx,
      userName,
      width - 100,
      height / 2 + 90,
      `bold 28px ${fs.existsSync(FONT_PATH) ? FONT_FAMILY : "sans-serif"}`
    );

    return canvas.toBuffer("image/png");
  } catch (error) {
    console.log("❌ generateGoodbyeCard error:", error);
  }
}

// generate default groupconfig
export function generateDefaultGroupConfig(ownerJid) {
  return {
    pemilik: ownerJid,
    security: {
      antilink: {
        status: false,
        link_blocked: [
          "chat.whatsapp.com",
          "wa.me",
          "t.me",
          "instagram.com",
          "facebook.com",
          "twitter.com",
          "tiktok.com",
          "discord.gg",
          "telegram.me",
          "bit.ly",
          "tinyurl.com",
        ],
        whitelist_admins: true,
        action: "delete",
        warning_message: "⚠️ Link tidak diperbolehkan di grup ini!",
        auto_kick_after: 3,
        exceptions: [
          "youtube.com",
          "youtu.be",
          "github.com",
          "google.com",
          "wikipedia.org",
          "stackoverflow.com",
        ],
        violations: {},
        last_violation: null,
      },
      antispam: {
        status: false,
        max_same_message: 3,
        time_window: 60,
        action: "mute",
        mute_duration: 300,
        whitelist_admins: true,
        warning_message: "🚫 Spam terdeteksi! Pesan dihapus.",
        reset_count_after: 3600,
        violations: {},
        message_cache: {},
        last_cleanup: null,
      },
      antiflood: {
        status: false,
        max_messages: 5,
        time_window: 10,
        action: "mute",
        mute_duration: 600,
        whitelist_admins: true,
        warning_message: "⚡ Pesan terlalu cepat! Mohon pelan-pelan.",
        progressive_mute: true,
        max_violations: 3,
        violations: {},
        message_timestamps: {},
        mute_progression: [300, 600, 1800, 3600],
      },
      antitagall: {
        status: false,
        max_mentions: 5,
        action: "delete",
        whitelist_admins: true,
        whitelist_users: [],
        warning_message: "⚠️ Jangan tag terlalu banyak orang sekaligus!",
        mute_duration: 300,
        allow_reply_mentions: true,
        violations: {},
        excluded_mentions: ["all", "everyone", "here"],
      },
      antidelete: {
        status: false,
        store_deleted_messages: true,
        forward_to_admins: false,
        show_in_group: true,
        max_stored_messages: 100,
        ignore_admins: true,
        message_format: "🗑️ Pesan dihapus oleh @{user}:\n{message}",
        auto_cleanup_days: 7,
        deleted_messages: [],
        storage_full_action: "remove_oldest",
      },
      wordfilter: {
        status: false,
        blocked_words: [
          "politik",
          "sara",
          "hoax",
          "scam",
          "penipuan",
          "judi",
          "togel",
          "narkoba",
          "drugs",
        ],
        blocked_phrases: [
          "jual beli",
          "open bo",
          "investasi bodong",
          "get rich quick",
          "money game",
          "ponzi scheme",
          "binary option",
          "trading forex",
        ],
        action: "delete",
        warning_message: "⚠️ Pesan mengandung kata/frasa yang difilter",
        case_sensitive: false,
        whitelist_admins: true,
        auto_replace: false,
        replacement_text: "[FILTERED]",
        violations: {},
        custom_patterns: [],
      },
      nightmode: {
        status: false,
        start_time: "22:00",
        end_time: "06:00",
        timezone: "Asia/Jakarta",
        allowed_actions: ["admin_commands"],
        mute_non_admins: true,
        auto_message:
          "🌙 Grup dalam mode malam. Chat dibatasi hingga pagi hari.",
        weekend_mode: false,
        active_days: [1, 2, 3, 4, 5],
        current_status: "inactive",
        last_activation: null,
      },
      antiviewonce: {
        status: false,
        save_viewonce: true,
        forward_to_admins: false,
        show_in_group: false,
        warning_message: "👁️ View once message terdeteksi dan disimpan",
        storage_limit: 50,
        auto_cleanup_days: 3,
        saved_messages: [],
        storage_path: "/saved_viewonce/",
      },
      antisticker: {
        status: false,
        max_stickers: 3,
        time_window: 30,
        action: "delete",
        warning_message: "🎭 Jangan spam sticker!",
        whitelist_admins: true,
        mute_duration: 300,
        violations: {},
        sticker_cache: {},
      },
      antimedia: {
        status: false,
        max_media: 3,
        time_window: 60,
        blocked_types: ["video", "audio", "document"],
        max_file_size: 10485760,
        action: "delete",
        warning_message: "📎 Media spam terdeteksi!",
        whitelist_admins: true,
        violations: {},
        allowed_extensions: [".jpg", ".png", ".gif", ".pdf"],
        media_cache: {},
      },
      antiforward: {
        status: false,
        max_forwards: 2,
        time_window: 300,
        action: "delete",
        warning_message: "↪️ Jangan terlalu banyak forward pesan!",
        whitelist_admins: true,
        block_from_broadcast: true,
        violations: {},
        forward_cache: {},
        broadcast_detection: true,
      },
      raidprotection: {
        status: false,
        max_new_members: 5,
        time_window: 300,
        action: "lockgroup",
        auto_recovery_time: 1800,
        kick_new_members: true,
        alert_admins: true,
        emergency_contacts: [],
        whitelist_adders: [],
        raid_detected: false,
        new_member_log: [],
        lockdown_history: [],
      },
    },
    moderation: {
      welcome: {
        status: false,
        message:
          "👋 Selamat datang @{user} di grup @{group}!\n\nSilakan baca rules grup dan jangan lupa perkenalkan diri ya! 😊",
        media: null,
        delete_after: 0,
        mention_user: true,
      },
      goodbye: {
        status: false,
        message: "👋 Selamat tinggal @{user}. Semoga sukses di luar sana! 🙏",
        media: null,
        delete_after: 0,
      },
      autoroles: {
        status: false,
        new_member_role: "member",
        roles: {
          member: {
            permissions: ["send_messages", "send_media"],
            restrictions: [],
          },
          vip: {
            permissions: ["send_messages", "send_media", "mention_all"],
            restrictions: [],
          },
        },
      },
      warnings: {
        max_warnings: 3,
        warning_expiry: 604800,
        actions: {
          1: "warn",
          2: "mute",
          3: "kick",
        },
        user_warnings: {},
      },
    },
    automation: {
      auto_delete: {
        status: false,
        delete_commands: true,
        delete_after: 30,
        exclude_admins: true,
      },
      auto_pin: {
        status: false,
        pin_welcome: false,
        pin_announcements: true,
        auto_unpin_after: 86400,
      },
      scheduled_messages: {
        status: false,
        messages: [],
      },
    },
    statistics: {
      total_messages: 0,
      total_media: 0,
      total_violations: 0,
      most_active_user: null,
      daily_stats: {},
      violation_breakdown: {
        antilink: 0,
        antispam: 0,
        antiflood: 0,
        wordfilter: 0,
        antimedia: 0,
      },
    },
  };
}
