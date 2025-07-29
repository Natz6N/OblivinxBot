import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createCanvas } from "canvas";
import {
  generateWelcomeCard,
  generateGoodbyeCard,
} from "./src/Clients/groupHandle.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dummyImagePath = path.join(__dirname, "./src/media/images.jpg");
const dummyBgPath = path.join(__dirname, "./src/media/bg.png");

function createDummyImage(filePath, width, height, color = "#999") {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  fs.writeFileSync(filePath, canvas.toBuffer("image/png"));
}

// Buat dummy image jika tidak ada
if (!fs.existsSync(dummyImagePath)) {
  createDummyImage(dummyImagePath, 400, 400, "#bbb");
}
if (!fs.existsSync(dummyBgPath)) {
  createDummyImage(dummyBgPath, 800, 600, "#333");
}

async function testWelcomeCard() {
  const buffer = await generateWelcomeCard({
    userImageUrl: dummyImagePath,
    userName: "Testing User",
    groupName: "Test Group",
    backgroundImageUrl: dummyBgPath,
  });

  console.assert(buffer instanceof Buffer, "❌ WelcomeCard bukan Buffer");
  console.assert(buffer.length > 1000, "❌ WelcomeCard terlalu kecil");

  fs.writeFileSync(path.join(__dirname, "output_welcome.png"), buffer);
  console.log("✅ WelcomeCard berhasil dibuat");
}

async function testGoodbyeCard() {
  const buffer = await generateGoodbyeCard({
    userImageUrl: dummyImagePath,
    userName: "Testing User",
    groupName: "Test Group",
    backgroundImageUrl: dummyBgPath,
  });

  console.assert(buffer instanceof Buffer, "❌ GoodbyeCard bukan Buffer");
  console.assert(buffer.length > 1000, "❌ GoodbyeCard terlalu kecil");

  fs.writeFileSync(path.join(__dirname, "output_goodbye.png"), buffer);
  console.log("✅ GoodbyeCard berhasil dibuat");
}

async function runTests() {
  console.log("🚀 Memulai test...");
  await testWelcomeCard();
  await testGoodbyeCard();
  console.log("🏁 Semua test selesai.");
}

runTests();
