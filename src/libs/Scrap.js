import axios from "axios";
import fileManager from "../FileManagers/FileManager";

export default async function ssweb(query) {
  try {
    const response = await axios.get("https://api.apiflash.com/v1/urltoimage", {
      params: {
        access_key: "2fc9726e595d40eebdf6792f0dd07380",
        url: query,
      },
      responseType: "arraybuffer", // Penting agar dapat menyimpan file biner
    });

    await fileManager.saveFile(buffer, originalName, 'stickers');
    console.log("✅ Screenshot berhasil disimpan");
  } catch (error) {
    console.error("❌ Gagal mengambil screenshot:", error.message);
  }
}