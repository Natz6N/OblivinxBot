// commands/example.js - Contoh file command

/**
 * Register example commands to the MessageRegistry
 * @param {MessageRegistry} registry - The command registry instance
 */
export default function(registry) {
  
  // Contoh command sederhana
  registry.addGlobalCommand({
    name: 'say',
    aliases: ['echo', 'repeat'],
    description: 'Bot akan mengulangi pesan yang Anda berikan',
    usage: '/say <pesan>',
    category: 'fun',
    cooldown: 2,
    exec: async ({ args, reply }) => {
      if (args.length === 0) {
        return await reply('❌ Silakan berikan pesan yang ingin diulangi!\nContoh: /say Hello World');
      }
      
      const message = args.join(' ');
      await reply(`🔄 ${message}`);
    }
  });

  // Command dengan permission admin
  registry.addGlobalCommand({
    name: 'admintest',
    description: 'Test command khusus admin',
    usage: '/admintest',
    category: 'admin',
    isadmin: true,
    isgroup: true,
    exec: async ({ reply, messageInfo }) => {
      await reply(`✅ Halo admin ${messageInfo.participant?.split('@')[0]}! Anda berhasil menggunakan command admin.`);
    }
  });

  // Command dengan permission owner
  registry.addGlobalCommand({
    name: 'restart',
    description: 'Restart bot (owner only)',
    usage: '/restart',
    category: 'owner',
    isowner: true,
    exec: async ({ reply }) => {
      await reply('🔄 Bot sedang direstart...');
      
      // Tambahkan logic restart di sini
      setTimeout(() => {
        process.exit(0);
      }, 2000);
    }
  });

  // Command dengan media handling
  registry.addGlobalCommand({
    name: 'sticker',
    aliases: ['s', 'stiker'],
    description: 'Buat sticker dari gambar',
    usage: '/sticker (reply ke gambar)',
    category: 'media',
    cooldown: 5,
    exec: async ({ messageInfo, reply, sock }) => {
      const { message } = messageInfo;
      
      // Cek apakah ada gambar yang di-reply atau dikirim
      const quotedMsg = message.extendedTextMessage?.contextInfo?.quotedMessage;
      const imageMessage = message.imageMessage || quotedMsg?.imageMessage;
      
      if (!imageMessage) {
        return await reply('❌ Silakan reply gambar atau kirim gambar dengan caption /sticker');
      }
      
      try {
        await reply('🔄 Sedang membuat sticker...');
        
        // Download gambar
        const buffer = await sock.downloadMediaMessage({
          key: messageInfo.raw.key,
          message: { imageMessage }
        });
        
        // Kirim sebagai sticker
        await sock.sendMessage(messageInfo.sender, {
          sticker: buffer
        });
        
      } catch (error) {
        await reply('❌ Gagal membuat sticker. Pastikan file adalah gambar yang valid.');
      }
    }
  });

  // Command dengan multiple responses
  registry.addGlobalCommand({
    name: 'quote',
    aliases: ['motivasi'],
    description: 'Dapatkan quote inspiratif',
    usage: '/quote',
    category: 'fun',
    cooldown: 10,
    exec: async ({ reply }) => {
      const quotes = [
        "💪 Kegagalan adalah kesuksesan yang tertunda.",
        "🌟 Mimpi tanpa tindakan hanya angan-angan.",
        "🚀 Kesuksesan dimulai dari langkah pertama.",
        "💡 Belajar dari kesalahan adalah kunci kesuksesan.",
        "🎯 Fokus pada proses, bukan hasil.",
        "⭐ Setiap expert pernah menjadi pemula."
      ];
      
      const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
      await reply(`🔥 *Quote of the Day*\n\n${randomQuote}`);
    }
  });

  // Command dengan API call (contoh)
  registry.addGlobalCommand({
    name: 'joke',
    description: 'Dapatkan joke random',
    usage: '/joke',
    category: 'fun',
    cooldown: 5,
    exec: async ({ reply }) => {
      try {
        // Contoh jokes lokal (ganti dengan API call jika perlu)
        const jokes = [
          "Kenapa programmer suka kopi? Karena tanpa kopi, code-nya jadi Java-Script! ☕",
          "Mengapa komputer tidak pernah lapar? Karena sudah ada cookies! 🍪",
          "Apa bedanya HTML dan HTTPS? Yang satu markup, yang satu aman! 🔒"
        ];
        
        const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
        await reply(`😂 *Random Joke*\n\n${randomJoke}`);
        
      } catch (error) {
        await reply('❌ Gagal mengambil joke. Coba lagi nanti!');
      }
    }
  });

  // Command dengan validasi input
  registry.addGlobalCommand({
    name: 'calculator',
    aliases: ['calc', 'math'],
    description: 'Kalkulator sederhana',
    usage: '/calculator <operasi>\nContoh: /calculator 2 + 2',
    category: 'utility',
    cooldown: 3,
    exec: async ({ args, reply }) => {
      if (args.length < 3) {
        return await reply('❌ Format salah!\nContoh: /calculator 5 + 3\nOperator yang didukung: +, -, *, /');
      }
      
      try {
        const num1 = parseFloat(args[0]);
        const operator = args[1];
        const num2 = parseFloat(args[2]);
        
        if (isNaN(num1) || isNaN(num2)) {
          return await reply('❌ Masukkan angka yang valid!');
        }
        
        let result;
        switch (operator) {
          case '+':
            result = num1 + num2;
            break;
          case '-':
            result = num1 - num2;
            break;
          case '*':
            result = num1 * num2;
            break;
          case '/':
            if (num2 === 0) {
              return await reply('❌ Tidak bisa membagi dengan nol!');
            }
            result = num1 / num2;
            break;
          default:
            return await reply('❌ Operator tidak valid! Gunakan: +, -, *, /');
        }
        
        await reply(`🧮 *Kalkulator*\n\n${num1} ${operator} ${num2} = ${result}`);
        
      } catch (error) {
        await reply('❌ Terjadi error dalam perhitungan!');
      }
    }
  });

  console.log('✅ Example commands loaded successfully');
}