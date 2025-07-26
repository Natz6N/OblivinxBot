import JSONManager from "../../JSONManager.js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv"
dotenv.config()
/**
 * Fungsi untuk memuat file bahasa dari direktori Lang
 * @param {string} langCode - Kode bahasa, seperti "EN", "ID"
 * @returns {Object} data JSON bahasa
 */
function loadLanguageFile(langCode = "ID") {
  try {
    const filePath = path.resolve(
      `./src/Data/Lang/${langCode.toUpperCase()}.json`
    );
    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error(`❌ Gagal memuat bahasa ${langCode}:`, error.message);
    return {}; // fallback jika gagal
  }
}

// Contoh penggunaan:
const ID = loadLanguageFile("ID");
const EN = loadLanguageFile("EN");

const DirectDB = "./src/Data/JSON";
const Backup = "./src/Data/Backup";

function getLang(userId = "") {
  const cleanId = userId.replace(/[^0-9]/g, "");
  const userData = userDB.get(`users.${cleanId}`, {});
  const langCode = (userData.lang || "ID").toUpperCase();

  return config[langCode] || config.ID; // fallback ke ID
}

// Inisialisasi DB
const callDB = new JSONManager({
  filePath: `${DirectDB}/calls.json`,
  backupDir: `${Backup}/calls.json`,
  backupInterval: 24,
  maxBackups: 10,
});
const group = new JSONManager({
  filePath: `${DirectDB}/group.json`,
  backupDir: `${Backup}/group.json`,
  backupInterval: 24,
  maxBackups: 10,
});

const userDB = new JSONManager({
  filePath: `${DirectDB}/user.json`,
  backupDir: `${Backup}/user.json`,
  backupInterval: 24,
  maxBackups: 10,
});

const ownerDB = new JSONManager({
  filePath: `${DirectDB}/owner.json`,
  backupDir: `${Backup}/owner.json`,
  backupInterval: 24,
  maxBackups: 10,
});

// Fungsi permission
const isOwner = async (number) => {
  const cleanNumber = number.replace(/[^0-9]/g, "");
  const owners = ownerDB.get("owners", []);

  return owners.includes(cleanNumber);
};

const isPremium = async (number) => {
  const cleanNumber = number.replace(/[^0-9]/g, "");
  const user = userDB.get(`users.${cleanNumber}`, {});
  return user.isPremium || false;
};

const isBlocked = async (number) => {
  const cleanNumber = number.replace(/[^0-9]/g, "");
  const callData = callDB.get(`calls.${cleanNumber}`, {});
  return callData.blocked || false;
};
const initDatabases = async () => {
  await Promise.all([callDB.init(), userDB.init(), ownerDB.init()]);
};

// Global export
const config = {
  Botinfo:{
    BotName : process.env.NAMEBOT,
    version : process.env.VERSIONBOT
  },
  prefix: "!",
  callDB,
  userDB,
  ownerDB,
  isOwner,
  isPremium,
  isBlocked,
  EN,
  ID,
  loadLanguageFile,
  initDatabases,
  getLang,
  group,
};

export default config;
