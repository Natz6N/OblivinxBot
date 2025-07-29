<div style="text-align: center;">
  <img src="./src/media/OblivinxLogo.png" alt="Logo" style="max-width: 200px;" />
</div>

# Project Title

Hanya untuk hiburan dan untuk mengontrol group udah itu aja si aku kurang tawu soalnya hobi:V



# Installation

Install my-project with npm

```bash
  git clone https://github.com/Natz6N/OblivinxBot.git
  cp .env.example .env
  npm run dev
```
# Screenshots

![App Screenshot](https://via.placeholder.com/468x300?text=App+Screenshot+Here)


# Usage/Examples

## untuk menambah fitur

Kalian bisa membuat file dahulu di command terserah namanya apa trus untuk dasaran seperti ini 
```javascript
export default function(params_custom){
  // isinya
}
```
Setelah untuk menambah command bisa seperti ini
```javascript
  custom_name.addGlobalCommand({
    name: "name_custom",
    aliases: ["aliases1", "aliases2"],
    description: "description_feature",
    usage: `${custom_name.prefix}feature`,
    category: "category Feature",
    cooldown: 2,
    exec: async ({params}) => {
       // func
    },
  });

```

## penggunaan FileManagers

Berikut adalah contoh **penggunaan praktis** dari class `FileManager` yang sudah saya buat buat, dalam berbagai skenario umum:

1. **Menyimpan File Buffer**

Misalnya kamu menerima file dari WhatsApp/Telegram dan ingin menyimpannya:

```js
import fileManager from "./utils/FileManager.js"; // sesuaikan path kamu

// Misalnya kamu punya buffer dari file gambar
const buffer = await fetch("https://example.com/image.jpg").then(res => res.arrayBuffer());
const originalName = "image.jpg";
const result = await fileManager.saveFile(Buffer.from(buffer), originalName, "images");

if (result.success) {
  console.log("✅ File tersimpan di:", result.path);
} else {
  console.error("❌ Gagal menyimpan file:", result.error);
}
```

---

2. **Menghapus File**

Setelah file selesai diproses, kamu bisa menghapusnya:

```js
const filePath = result.path;
const deleted = await fileManager.deleteFile(filePath);

if (deleted) {
  console.log("🗑️ File berhasil dihapus.");
} else {
  console.log("⚠️ File tidak ditemukan atau gagal dihapus.");
}
```

---

3. **Mengecek File Ada atau Tidak**

```js
const filePath = fileManager.getFilePath("images", "nama_file.jpg");
if (fileManager.fileExists(filePath)) {
  console.log("📂 File tersedia");
} else {
  console.log("❌ File tidak ditemukan");
}
```

---

4. **Mendapatkan Informasi File**

```js
const info = await fileManager.getFileInfo(filePath);
if (info) {
  console.log(`📁 Ukuran: ${info.size} byte`);
  console.log(`🕒 Dibuat: ${info.created}`);
  console.log(`✏️ Diubah: ${info.modified}`);
}
```

---

5. **Membersihkan File Sementara**

Misalnya kamu ingin membersihkan file sementara lebih dari 1 jam:

```js
await fileManager.cleanTempFiles(60 * 60 * 1000); // 1 jam
```

Jalankan ini secara terjadwal, misalnya dengan `setInterval` atau cron.

---

6. **Contoh Integrasi di Bot WhatsApp (misalnya pakai Baileys)**

```js
const media = await downloadMediaMessage(message, "buffer");
const saveResult = await fileManager.saveFile(media, "voice.ogg", "audio");

if (saveResult.success) {
  await sock.sendMessage(sender, {
    text: `📁 Voice note berhasil disimpan!\nLokasi: ${saveResult.fileName}`
  });
}
```

---

7. **Dapatkan Path Folder Kategori**

```js
const imageDir = fileManager.getDirectoryPath("images");
console.log("📂 Folder untuk image:", imageDir);
```

## Penggunaan JSONManager

Berikut ini adalah contoh **penggunaan praktis dan lengkap** dari class `JSONManager` yang kamu buat, untuk kasus umum seperti pengelolaan data konfigurasi bot, cache user, atau penyimpanan sederhana.

---

1. **Instansiasi dan Inisialisasi**

```ts
import JSONManager from "./utils/JSONManager.js"; // Sesuaikan path kamu

// Inisialisasi
const configManager = new JSONManager({
  filePath: "./src/data/config.json",
  backupDir: "./src/data/backups",
  backupInterval: 12, // Jam
  maxBackups: 5,
  autoBackup: true,
});

await configManager.init(); // WAJIB dipanggil sebelum penggunaan lainnya
```

---

2. **Mendapatkan Seluruh Data**

```ts
const allConfig = configManager.getData();
console.log("📦 Konfigurasi lengkap:", allConfig);
```

---

3. **Ambil Nilai Tertentu**

```ts
const prefix = configManager.get("bot.prefix", "!");
console.log("⚙️ Prefix saat ini:", prefix);
```

---

4. **Set Nilai (Tambah/Update)**

```ts
await configManager.set("bot.prefix", "#");
await configManager.set("owner.number", "6281234567890");
console.log("✅ Prefix dan owner di-update");
```

---

5. **Push ke Array**

```ts
await configManager.push("admins", "6289998887777");
console.log("➕ Admin baru ditambahkan ke daftar");
```

---

6. **Hapus Nilai**

```ts
await configManager.delete("owner.number");
console.log("🗑️ Owner dihapus");
```

---

7. **Merge Data (Update Banyak Sekaligus)**

```ts
await configManager.update({
  bot: {
    name: "Oblivinx",
    status: "online",
  },
});
console.log("🔁 Data bot diupdate");
```

---

8. **Reset Semua Data**

```ts
await configManager.reset({
  bot: { prefix: "!" },
});
console.log("🧹 Semua data dikembalikan ke default");
```

---

9. **Backup Manual & Restore**

### 📤 Membuat Backup Manual

```ts
const backupPath = await configManager.createBackup();
console.log("💾 Backup disimpan di:", backupPath);
```

### 📥 Restore dari Backup Tertentu

```ts
await configManager.restoreFromBackup("./src/data/backups/backup_2025-07-29T10-00-00.json");
console.log("♻️ Data dikembalikan dari backup");
```

---

10. **Restore dari Backup Terbaru**

```ts
await configManager.restoreFromLatestBackup();
console.log("♻️ Data dikembalikan dari backup terbaru");
```

---

11. **Dapatkan Daftar Semua Backup**

```ts
const backups = await configManager.getBackupList();
console.log("📂 Semua backup tersedia:", backups);
```

---

12. **Matikan Auto Backup dan Tutup**

```ts
await configManager.close();
console.log("✅ JSONManager ditutup dengan aman");
```

---

### 📌 Tips Integrasi:

* Gunakan satu `JSONManager` per kebutuhan data (misal: `config.json`, `userData.json`, dll).
* Pastikan `init()` dipanggil **hanya sekali**, dan sebelum operasi lainnya.
* Letakkan `createBackup()` dalam jadwal cron atau saat shutdown.
* Gunakan `.get("a.b.c")` untuk mengakses properti nested dengan mudah.
## License

[MIT](https://choosealicense.com/licenses/mit/)


## Authors

- [@natzsixn](https://github.com/Natz6N)

