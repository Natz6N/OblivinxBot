import { tmpdir } from "os";
import Crypto from "crypto";
import ff from "fluent-ffmpeg";
import webp from "node-webpmux";
import fs from "fs";
import path from "path";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
ff.setFfmpegPath(ffmpegInstaller.path);

// Fungsi untuk menghasilkan nama acak jika tidak ada nama kustom
function generateRandomName(ext) {
  return `${Crypto.randomBytes(10).toString("hex")}${ext}`;
}

// Fungsi imageToWebp dengan log dan error handling
async function imageToWebp(image, customName = null) {
  const fileName = customName
    ? `${customName}.webp`
    : generateRandomName(".webp");
  const tempFile = path.join(tmpdir(), fileName);
  const tempInput = path.join(
    tmpdir(),
    customName ? `${customName}.jpg` : generateRandomName(".jpg")
  );

  console.log(
    `[imageToWebp] Input file: ${tempInput}, Output file: ${tempFile}`
  );

  try {
    fs.writeFileSync(tempInput, image);
    console.log(`[imageToWebp] Input file written, size: ${image.length}`);

    await new Promise((resolve, reject) => {
      ff(tempInput)
        .outputOptions([
          "-vf",
          "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15, pad=320:320:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse",
        ])
        .toFormat("webp")
        .save(tempFile)
        .on("end", () => {
          console.log(`[imageToWebp] Conversion completed`);
          resolve();
        })
        .on("error", (err) => {
          console.error(`[imageToWebp] FFmpeg error: ${err.message}`);
          reject(err);
        });
    });

    const buffer = fs.readFileSync(tempFile);
    console.log(`[imageToWebp] Output buffer size: ${buffer.length}`);

    fs.unlinkSync(tempFile);
    fs.unlinkSync(tempInput);
    return buffer;
  } catch (error) {
    console.error(`[imageToWebp] Error: ${error.message}`);
    try {
      fs.unlinkSync(tempFile);
      fs.unlinkSync(tempInput);
    } catch {}
    throw error;
  }
}

// Fungsi videoToWebp dengan log dan error handling
async function videoToWebp(video, customName = null) {
  const fileName = customName
    ? `${customName}.webp`
    : generateRandomName(".webp");
  const tempFile = path.join(tmpdir(), fileName);
  const tempInput = path.join(
    tmpdir(),
    customName ? `${customName}.mp4` : generateRandomName(".mp4")
  );

  console.log(
    `[videoToWebp] Input file: ${tempInput}, Output file: ${tempFile}`
  );

  try {
    fs.writeFileSync(tempInput, video);
    console.log(`[videoToWebp] Input file written, size: ${video.length}`);

    await new Promise((resolve, reject) => {
      ff(tempInput)
        .inputOptions(["-y", "-t", "20"])
        .outputOptions([
          "-vcodec",
          "libwebp",
          "-vf",
          "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15, pad=320:320:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse",
          "-loop",
          "0",
          "-ss",
          "00:00:00",
          "-t",
          "20",
          "-preset",
          "default",
          "-an",
          "-vsync",
          "0",
        ])
        .toFormat("webp")
        .save(tempFile)
        .on("end", () => {
          console.log(`[videoToWebp] Conversion completed`);
          resolve();
        })
        .on("error", (err) => {
          console.error(`[videoToWebp] FFmpeg error: ${err.message}`);
          reject(err);
        });
    });

    const buffer = fs.readFileSync(tempFile);
    console.log(`[videoToWebp] Output buffer size: ${buffer.length}`);

    fs.unlinkSync(tempFile);
    fs.unlinkSync(tempInput);
    return buffer;
  } catch (error) {
    console.error(`[videoToWebp] Error: ${error.message}`);
    try {
      fs.unlinkSync(tempFile);
      fs.unlinkSync(tempInput);
    } catch {}
    throw error;
  }
}

// Fungsi writeExifImg
async function writeExifImg(image, metadata, customName = null) {
  console.log(`[writeExifImg] Starting with metadata:`, metadata);
  try {
    const img = new webp.Image();
    const json = {
      "sticker-pack-id": "OrbitStudio",
      "sticker-pack-name": metadata.packname || "DefaultPack",
      "sticker-pack-publisher": metadata.author || "Unknown",
      emojis: metadata.categories || [""],
    };
    const exifAttr = Buffer.from([
      0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
      0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
    ]);
    const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8");
    const exif = Buffer.concat([exifAttr, jsonBuff]);
    exif.writeUIntLE(jsonBuff.length, 14, 4);

    const webpBuffer = await imageToWebp(image, customName);
    await img.load(webpBuffer);
    img.exif = exif;
    const result = await img.save(null);
    console.log(`[writeExifImg] Sticker buffer size: ${result.length}`);
    return result;
  } catch (error) {
    console.error(`[writeExifImg] Error: ${error.message}`);
    throw error;
  }
}

// Fungsi writeExifVid
async function writeExifVid(video, metadata, customName = null) {
  console.log(`[writeExifVid] Starting with metadata:`, metadata);
  try {
    const img = new webp.Image();
    const json = {
      "sticker-pack-id": "OrbitStudio",
      "sticker-pack-name": metadata.packname || "DefaultPack",
      "sticker-pack-publisher": metadata.author || "Unknown",
      emojis: metadata.categories || [""],
    };
    const exifAttr = Buffer.from([
      0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
      0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
    ]);
    const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8");
    const exif = Buffer.concat([exifAttr, jsonBuff]);
    exif.writeUIntLE(jsonBuff.length, 14, 4);

    const webpBuffer = await videoToWebp(video, customName);
    await img.load(webpBuffer);
    img.exif = exif;
    const result = await img.save(null);
    console.log(`[writeExifVid] Sticker buffer size: ${result.length}`);
    return result;
  } catch (error) {
    console.error(`[writeExifVid] Error: ${error.message}`);
    throw error;
  }
}

// Fungsi writeExifWebp
async function writeExifWebp(
  media,
  metadata,
  customNameIn = null,
  customNameOut = null
) {
  const tmpFileIn = path.join(
    tmpdir(),
    customNameIn
      ? `${customNameIn}.webp`
      : `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`
  );
  const tmpFileOut = path.join(
    tmpdir(),
    customNameOut
      ? `${customNameOut}.webp`
      : `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`
  );

  console.log(
    `[writeExifWebp] Input file: ${tmpFileIn}, Output file: ${tmpFileOut}`
  );

  try {
    fs.writeFileSync(tmpFileIn, media);
    console.log(`[writeExifWebp] Input file written, size: ${media.length}`);

    const img = new webp.Image();
    const json = {
      "sticker-pack-id": "NatzsixnPacks",
      "sticker-pack-name": metadata.packname || "NatzsixnPacks",
      "sticker-pack-publisher": metadata.author || "OrbitStudio",
      emojis: metadata.categories || [""],
    };
    const exifAttr = Buffer.from([
      0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
      0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
    ]);
    const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8");
    const exif = Buffer.concat([exifAttr, jsonBuff]);
    exif.writeUIntLE(jsonBuff.length, 14, 4);

    await img.load(tmpFileIn);
    img.exif = exif;
    await img.save(tmpFileOut);

    const buffer = fs.readFileSync(tmpFileOut);
    console.log(`[writeExifWebp] Output buffer size: ${buffer.length}`);

    fs.unlinkSync(tmpFileIn);
    fs.unlinkSync(tmpFileOut);
    return buffer;
  } catch (error) {
    console.error(`[writeExifWebp] Error: ${error.message}`);
    try {
      fs.unlinkSync(tmpFileIn);
      fs.unlinkSync(tmpFileOut);
    } catch {}
    throw error;
  }
}

export { imageToWebp, videoToWebp, writeExifImg, writeExifVid, writeExifWebp };
