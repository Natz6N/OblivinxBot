import { botLogger } from "../bot.js";
export default function (registry) {
  // registry.addGlobalCommand({
  //   name: "upscale",
  //   aliases: ["hdimg", "hd", "waifu2x"],
  //   description: "Upscaling gambar dengan AI (resolusi 2x)",
  //   usage: "/hd",
  //   category: "img",
  //   cooldown: 2,

  //   exec: async ({ sock, reply, messageInfo }) => {
  //     try {
  //       // console.log("remoteJid:", messageInfo.remoteJid);
  //       const { message, sender } = messageInfo;
  //       const quotedMsg =
  //         message?.extendedTextMessage?.contextInfo?.quotedMessage;
  //       const imageMsg = quotedMsg?.imageMessage || message.imageMessage;

  //       if (
  //         !imageMsg ||
  //         !imageMsg.mimetype ||
  //         !/image\/(jpe?g|png)/i.test(imageMsg.mimetype)
  //       ) {
  //         return reply(
  //           "❌ Kirim atau balas gambar (JPG/PNG) dengan perintah ini."
  //         );
  //       }

  //       const mediaMsg = quotedMsg
  //         ? { message: { imageMessage: quotedMsg.imageMessage } }
  //         : { message };

  //       const buffer = await downloadMediaMessage(
  //         mediaMsg,
  //         "buffer",
  //         {},
  //         { logger: botLogger }
  //       );

  //       if (!buffer) return reply("❌ Gagal mendownload gambar.");

  //       const mime = imageMsg.mimetype;
  //       const ext = mime.split("/")[1];
  //       const filename = `upscaled_${Date.now()}.${ext}`;

  //       const form = new FormData();
  //       form.append("image", buffer, { filename, contentType: mime });
  //       form.append("scale", "2");

  //       const headers = {
  //         ...form.getHeaders(),
  //         accept: "application/json",
  //         "x-client-version": "web",
  //         "x-locale": "es",
  //       };

  //       const res = await fetch("https://api2.pixelcut.app/image/upscale/v1", {
  //         method: "POST",
  //         headers,
  //         body: form,
  //       });

  //       if (!res.ok) {
  //         const text = await res.text();
  //         return reply(`❌ Gagal upscale gambar: ${res.status} - ${text}`);
  //       }

  //       const json = await res.json();

  //       if (!json?.result_url) {
  //         return reply("❌ Gagal mendapatkan gambar hasil dari Pixelcut.");
  //       }

  //       const response = await fetch(json.result_url);
  //       const arrayBuffer = await response.arrayBuffer();
  //       const resultBuffer = Buffer.from(arrayBuffer);

  //       await sock.sendMessage(
  //         sender,
  //         {
  //           image: resultBuffer,
  //           caption: `✅ Upscaling berhasil! Gambar telah ditingkatkan 2x resolusinya.`,
  //         },
  //         { quoted: messageInfo.raw }
  //       );
  //     } catch (err) {
  //       console.log(err);
  //       return reply(
  //         `❌ Terjadi kesalahan saat proses upscaling:\n${err.message}`
  //       );
  //     }
  //   },
  // });
  botLogger.info("✅ GroupCommands Is Loaded");
}
