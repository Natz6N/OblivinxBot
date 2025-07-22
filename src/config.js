import JSONManager from "./FileManagers/JSONManager.js";
import fs from "fs";

const DirectDB = "./src/Data/JSON";
const Backup = "./src/Data/Backup";

// Cek & load BotInfo.json
let botInfo = {};
try {
  botInfo = JSON.parse(fs.readFileSync("./src/Data/BotInfo.json", "utf8"));
} catch (err) {
  console.error("❌ Gagal membaca BotInfo.json:", err.message);
  botInfo = {};
}

// Inisialisasi DB
const callDB = new JSONManager({
  filePath: `${DirectDB}/calls.json`,
  backupDir: `${Backup}/calls.json`,
  backupInterval: 24,
  maxBackups: 10,
});

const userDB = new JSONManager({
  filePath: `${DirectDB}/user.json`,
  backupDir:`${Backup}/user.json`,
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

// Global export
const config = {
  Botinfo: botInfo,
  callDB,
  userDB,
  ownerDB,
  isOwner,
  isPremium,
  isBlocked,
};

export default config;
