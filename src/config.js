import JSONManager from "../../JSONManager.js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { jidNormalizedUser } from "@whiskeysockets/baileys";
import OblivinxLogger from "./libs/Logger.js";
dotenv.config();
const apcb = new OblivinxLogger({
  enabled: process.env.DEBUGMODE
})
console.log(apcb)
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
async function getUserName(sock, jid) {
  try {
    const [result] = await sock.onWhatsApp(jid);
    return result?.notify || result?.name || jid.split("@")[0]; // fallback
  } catch (e) {
    return jid.split("@")[0];
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
  await Promise.all([
    callDB.init(),
    userDB.init(),
    ownerDB.init(),
    group.init(),
  ]);
};
async function getParticipantNames(sock, metadata) {
  const names = {};

  for (const p of metadata.participants) {
    const jid = p.id;
    const name = await getUserName(sock, jid);
    names[jid] = name;
  }

  return names;
}

// Global export
const config = {
  apcb,
  Botinfo: {
    BotName: process.env.NAMEBOT,
    version: process.env.VERSIONBOT,
  },
  prefix: "!",
  callDB,
  userDB,
  ownerDB,
  isOwner,
  isPremium,
  isBlocked,
  EN,
  getParticipantNames,
  ID,
  loadLanguageFile,
  initDatabases,
  getLang,
   pairingCode: {
    // Set to true untuk menggunakan pairing code, false untuk QR code
    enabled: true, // Ubah ini menjadi true untuk mengaktifkan pairing code
    
    // Nomor telepon untuk pairing (format: 62xxxxxxxxx)
    // Pastikan menggunakan country code yang benar
    phoneNumber: "6281910058235", // Ganti dengan nomor WhatsApp Anda
    
    // Advanced pairing options (optional)
    options: {
      // Timeout untuk pairing code dalam ms (default: 60000 = 1 menit)
      timeout: 60000,
      
      // Retry attempts jika pairing gagal
      maxRetries: 3,
      
      // Delay antara retry dalam ms
      retryDelay: 5000
    }
  },
  group,
   // Enhanced connection options
  connection: {
    // Maximum reconnection attempts
    maxReconnectAttempts: 15,
    
    // Reconnection delay multiplier
    reconnectDelayMultiplier: 1.5,
    
    // Base reconnection delay in ms
    baseReconnectDelay: 2000,
    
    // Maximum reconnection delay in ms
    maxReconnectDelay: 60000,
    
    // Connection timeout in ms
    connectionTimeout: 90000,
    
    // Keep alive interval in ms
    keepAliveInterval: 15000
  },

  // Message queue configuration
  queue: {
    // Maximum concurrent message processing
    maxConcurrent: 12,
    
    // Maximum queue size
    maxQueueSize: 2500,
    
    // Retry attempts for failed messages
    retryAttempts: 3,
    
    // Retry delay in ms
    retryDelay: 1000,
    
    // Processing timeout per message in ms
    processingTimeout: 30000
  },

  // Error handling configuration
  errorHandling: {
    // Maximum consecutive errors before shutdown
    maxConsecutiveErrors: 15,
    
    // Log level: 'debug', 'info', 'warn', 'error'
    logLevel: 'info',
    
    // Enable detailed error logging
    detailedLogging: true,
    
    // Auto recovery for certain errors
    autoRecovery: true,
    
    // Recovery delay in ms
    recoveryDelay: 5000
  },

  // Memory management configuration
  memory: {
    // Enable automatic garbage collection
    autoGC: true,
    
    // GC threshold in MB
    gcThreshold: 250,
    
    // Memory warning threshold in MB
    warningThreshold: 400,
    
    // Critical memory threshold in MB
    criticalThreshold: 600,
    
    // Health check interval in ms
    healthCheckInterval: 90000
  },
  NormalizeJid: (jid)=>{
    return jidNormalizedUser(jid)
  }
};

export default config;

// Validation functions
export function validatePairingConfig() {
  const issues = [];
  
  if (config.pairingCode?.enabled) {
    if (!config.pairingCode.phoneNumber) {
      issues.push("Pairing code enabled but no phone number provided");
    } else {
      const phoneNumber = config.pairingCode.phoneNumber.toString();
      
      // Remove non-numeric characters for validation
      const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
      
      if (cleanNumber.length < 10) {
        issues.push("Phone number too short for pairing code");
      }
      
      if (!cleanNumber.startsWith('62') && !cleanNumber.startsWith('0')) {
        issues.push("Phone number should start with country code (62) or 0");
      }
      
      if (!/^\d+$/.test(cleanNumber)) {
        issues.push("Phone number contains invalid characters");
      }
    }
  }
  
  return issues;
}

export function formatPhoneNumber(phoneNumber) {
  if (!phoneNumber) return null;
  
  let formatted = phoneNumber.toString().replace(/[^0-9]/g, '');
  
  // Convert local format (08xxx) to international (628xxx)
  if (formatted.startsWith('0')) {
    formatted = '62' + formatted.substring(1);
  }
  
  // Ensure it starts with 62 for Indonesia
  if (!formatted.startsWith('62')) {
    formatted = '62' + formatted;
  }
  
  return formatted;
}