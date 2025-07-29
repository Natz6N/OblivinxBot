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
