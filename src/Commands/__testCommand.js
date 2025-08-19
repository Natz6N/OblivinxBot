import config from "../config.js";
import pkg from "@whiskeysockets/baileys";
const { generateWAMessageFromContent, proto, prepareWAMessageMedia } = pkg;
export default function (registry) {
  registry.addGlobalCommand({
    name: "listclassic",
    description: "Tes kirim list klasik",
    usage: `${registry.prefix}listclassic`,
    category: "general",
    exec: async ({ sock, messageInfo }) => {
      const listJson = {
        title: "📋 Test List",
        sections: [
          {
            title: "Menu Utama",
            rows: [
              {
                title: "All Menu",
                description: "📌 Menampilkan All Menu",
                id: "allmenu",
              },
              {
                title: "Donasi",
                description: "💸 Menampilkan menu donasi",
                id: "donasi",
              },
            ],
          },
        ],
      };

      const msg = generateWAMessageFromContent(
        messageInfo.chat,
        {
          viewOnceMessage: {
            message: {
              interactiveMessage: proto.Message.InteractiveMessage.create({
                body: proto.Message.InteractiveMessage.Body.create({
                  text: "Silakan pilih menu di bawah 👇",
                }),
                footer: proto.Message.InteractiveMessage.Footer.create({
                  text: "By Hydro Bot",
                }),
                header: proto.Message.InteractiveMessage.Header.create({
                  hasMediaAttachment: true,
                  ...(await prepareWAMessageMedia(
                    {
                      image: {
                        url: "https://raw.githubusercontent.com/AhmadAkbarID/media/refs/heads/main/menu.jpg",
                      },
                    },
                    { upload: sock.waUploadToServer }
                  )),
                }),
                nativeFlowMessage:
                  proto.Message.InteractiveMessage.NativeFlowMessage.create({
                    buttons: [
                      {
                        name: "single_select",
                        buttonParamsJson: JSON.stringify(listJson),
                      },
                    ],
                  }),
              }),
            },
          },
        },
        { quoted: messageInfo.raw }
      );

      await sock.relayMessage(messageInfo.chat, msg.message, { messageId: msg.key.id });
    },
  });

  registry.addGlobalCommand({
    name: "tests",
    aliases: ["tst"],
    description: "Tampilkan menu interaktif dengan list",
    usage: `${registry.prefix}tests`,
    category: "general",
    cooldown: 5,
    exec: async ({ messageInfo }) => {
      try {
        const sections = [
          {
            title: "🚀 Aksi Cepat",
            rows: [
              {
                title: "📄 Bantuan",
                description: "Lihat semua perintah yang tersedia",
                id: `${registry.prefix}help`,
              },
              {
                title: "📊 Ping",
                description: "Cek kecepatan respon bot",
                id: `${registry.prefix}ping`,
              },
              {
                title: "👑 Owner",
                description: "Tampilkan kontak pemilik bot",
                id: `${registry.prefix}owner`,
              },
            ],
          },
          {
            title: "🛠️ Utilitas",
            rows: [
              {
                title: "📊 Status Bot",
                description: "Lihat status operasional bot",
                id: `${registry.prefix}status`,
              },
              {
                title: "ℹ️ Info Bot",
                description: "Tampilkan informasi tentang bot ini",
                id: `${registry.prefix}info`,
              },
            ],
          },
        ];

        // Memanggil metode sendListMessage yang sudah diperbaiki dari registry
        await registry.sendListMessage(messageInfo.chat, {
          text: "🧪 *List Test Menu*\nPilih opsi dari daftar di bawah ini:",
          footer: `By ${config.Botinfo?.BotName || "MyBot"}`,
          title: "📋 Test List Menu",
          buttonText: "🔍 Lihat Opsi",
          sections,
          quoted: messageInfo.raw,
        });
      } catch (error) {
        console.error("Error in 'tests' command:", error);
        // Anda bisa menambahkan balasan error ke pengguna di sini jika perlu
        await registry.sock.sendMessage(messageInfo.chat, {
          text: "❌ Terjadi kesalahan saat menampilkan menu.",
        });
      }
    },
  });

  // Updated minimal command with HydratedTemplate
  registry.addGlobalCommand({
    name: "minimal",
    aliases: ["min"],
    description: "Menu dengan hydrated template buttons",
    usage: `${registry.prefix}minimal`,
    category: "general",
    cooldown: 2,
    exec: async ({ sock, messageInfo }) => {
      try {
        const sections = [
          {
            title: "Kategori Utama",
            rows: [
              {
                header: "Sistem Bantuan",
                title: "Perintah Bantuan",
                description: "Menampilkan semua perintah yang tersedia",
                id: `${registry.prefix}help`,
              },
              {
                header: "Cek Performa",
                title: "Tes Ping",
                description: "Mengecek waktu respons bot",
                id: `${registry.prefix}ping`,
              },
            ],
          },
          {
            title: "⚙️ Pengaturan Bot",
            rows: [
              {
                header: "Status Sistem",
                title: "Status Bot",
                description: "Mengecek status bot saat ini",
                id: `${registry.prefix}stats`,
              },
            ],
          },
        ];

        // Gunakan fungsi sendListMessage yang sudah ada di RegistryCommands.js
        // Fungsi ini akan menggunakan format pesan List yang benar
        await registry.sendInteractiveAdvanced(
          messageInfo.chat,
          "🧪 *List Test Menu*\nPilih opsi dari daftar di bawah ini:",
          {
            title: "📋 Test List Menu",
            buttonTitle: "🔍 Lihat Opsi",
            sections, // format sections: [{ title, rows: [{ title, description, id }] }]
          },
          messageInfo.raw,
          config.Botinfo?.OwnerName || "Owner"
        );

        console.log("✅ List message sent successfully");
      } catch (error) {
        console.error("❌ Error in listtest command:", error);
      }
    },
  });
}
