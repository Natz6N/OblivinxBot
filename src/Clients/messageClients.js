import {
  isJidNewsletter,
  downloadMediaMessage,
  jidNormalizedUser,
} from "@whiskeysockets/baileys";
import { readdirSync } from "fs";
import path, { join, dirname } from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import config from "../config.js";
import fileManager from "../FileManagers/FileManager.js";
// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import pkg from "@whiskeysockets/baileys";
const { proto, generateWAMessage, areJidsSameUser } = pkg;
// Utility functions
export const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// Constants
const TYPING_DELAYS = {
  SUBSCRIBE: 500,
  COMPOSING: 1000,
};

const MESSAGE_TYPES = {
  IMAGE: "imageMessage",
  VIDEO: "videoMessage",
  DOCUMENT: "documentMessage",
  AUDIO: "audioMessage",
  STICKER: "stickerMessage",
  TEXT: "conversation",
  EXTENDED_TEXT: "extendedTextMessage",
  BUTTONS_RESPONSE: "buttonsResponseMessage",
  LIST_RESPONSE: "listResponseMessage",
  TEMPLATE_BUTTON_REPLY: "templateButtonReplyMessage",
  POLL_UPDATE: "pollUpdateMessage",
  MESSAGE_CONTEXT_INFO: "messageContextInfo",
  INTERACTIVE_RESPONSE: "interactiveResponseMessage",
};
const BOT_INFO_PATH = path.join("./src/Data/BotInfo.json");

// Fungsi untuk ambil status bot
async function getBotStatus() {
  try {
    const data = await fs.readFile(BOT_INFO_PATH, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Gagal membaca botinfo.json:", err);
    return { status: "on", alasan: "" }; // default jika gagal baca
  }
}

const MEDIA_TYPES = [
  MESSAGE_TYPES.IMAGE,
  MESSAGE_TYPES.VIDEO,
  MESSAGE_TYPES.DOCUMENT,
  MESSAGE_TYPES.AUDIO,
  MESSAGE_TYPES.STICKER,
];

const BUTTON_RESPONSE_TYPES = [
  MESSAGE_TYPES.BUTTONS_RESPONSE,
  MESSAGE_TYPES.TEMPLATE_BUTTON_REPLY,
  MESSAGE_TYPES.LIST_RESPONSE,
  MESSAGE_TYPES.POLL_UPDATE,
  MESSAGE_TYPES.INTERACTIVE_RESPONSE,
];

const TEXT_MESSAGE_TYPES = [MESSAGE_TYPES.TEXT, MESSAGE_TYPES.EXTENDED_TEXT];
async function handleMessage(sock, sender, messageContent, registry) {
  try {
    const botInfo = await getBotStatus();
    const isOwner = await config.isOwner(sender);
    const text = messageContent.text || "";
    const isCommand = text.startsWith(registry.prefix);

    if (
      ["off", "maintenance"].includes(botInfo.status?.toLowerCase()) &&
      !isOwner &&
      isCommand
    ) {
      await sock.sendMessage(sender, {
        text: `Hi, bot sedang *${botInfo.alasan || "tidak aktif"}*.`,
        title: "👋 Hai!",
        subtitle: "🌼 Subjudul di sini",
        footer: "📩 Dikirim oleh Naruya Izumi",
        interactiveButtons: [
          {
            name: "cta_url",
            buttonParamsJson: JSON.stringify({
              display_text: "🌐 Kunjungi Channel",
              url: "https://whatsapp.com/channel/0029Vag9VSI2ZjCocqa2lB1y",
              merchant_url:
                "https://whatsapp.com/channel/0029Vag9VSI2ZjCocqa2lB1y",
            }),
          },
          {
            name: "cta_url",
            buttonParamsJson: JSON.stringify({
              display_text: "🌐 Kunjungi Channel",
              url: "https://whatsapp.com/channel/0029Vag9VSI2ZjCocqa2lB1y",
              merchant_url:
                "https://whatsapp.com/channel/0029Vag9VSI2ZjCocqa2lB1y",
            }),
          },
          {
            name: "cta_call",
            buttonParamsJson: JSON.stringify({
              display_text: "📞 Telepon Saya",
              phone_number: "628xxxx",
            }),
          },
        ],
      });

      return true; // ✅ hentikan eksekusi fitur lain
    }

    return false; // ✅ lanjutkan ke fitur berikutnya
  } catch (error) {
    console.log(error);
  }
}

async function appendTextMessage(sock, chatUpdate, msg, text) {
  try {
    const messages = await generateWAMessage(
      msg.key.remoteJid,
      { 
        text, 
        mentions: msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [] 
      },
      { 
        userJid: sock.user.id, 
        quoted: msg.quoted?.fakeObj 
      }
    );

    messages.key.fromMe = areJidsSameUser(
      msg.key.participant || msg.key.remoteJid, 
      sock.user.id
    );
    messages.key.id = msg.key.id;
    messages.pushName = msg.pushName;
    if (msg.key.participant) messages.participant = msg.key.participant;

    const upsert = {
      ...chatUpdate,
      messages: [proto.WebMessageInfo.fromObject(messages)],
      type: "append",
    };

    sock.ev.emit("messages.upsert", upsert);
    return text;
  } catch (error) {
    console.error("Error in appendTextMessage:", error);
    return text;
  }
}

/**
 * Enhanced function to extract button response data
 * @param {Object} message - Baileys message object
 * @returns {Object} Button response data
 */
function extractButtonResponse(message) {
  if (!message) return { buttonId: "", displayText: "", type: "none" };

  const messageType = Object.keys(message)[0];
  const messageData = message[messageType];

  if (!messageData) return { buttonId: "", displayText: "", type: "none" };

  let buttonId = "";
  let displayText = "";
  let responseType = "none";

  switch (messageType) {
    case MESSAGE_TYPES.BUTTONS_RESPONSE:
      // Handle HydratedTemplate button responses
      buttonId =
        messageData.selectedButtonId ||
        messageData.selectedButton?.buttonId ||
        messageData.selectedButton?.id ||
        messageData.button?.buttonId ||
        messageData.button?.id ||
        messageData.buttonId ||
        messageData.id ||
        "";

      displayText =
        messageData.selectedButton?.displayText ||
        messageData.button?.displayText ||
        messageData.displayText ||
        messageData.text ||
        buttonId; // Use buttonId as fallback for displayText
      responseType = "button";
      break;

    case MESSAGE_TYPES.TEMPLATE_BUTTON_REPLY:
      buttonId = messageData.selectedId || "";
      displayText = messageData.selectedDisplayText || messageData.selectedId || "";
      responseType = "template_button";
      break;

    case MESSAGE_TYPES.LIST_RESPONSE:
      buttonId = messageData.singleSelectReply?.selectedRowId || "";
      displayText = messageData.singleSelectReply?.title || messageData.singleSelectReply?.selectedRowId || "";
      responseType = "list";
      break;

    case MESSAGE_TYPES.POLL_UPDATE:
      // Handle poll responses
      const pollUpdates = messageData.pollUpdates || [];
      if (pollUpdates.length > 0) {
        buttonId = pollUpdates[0].pollUpdateMessageKey?.id || "";
        displayText = "Poll Response";
        responseType = "poll";
      }
      break;

    case MESSAGE_TYPES.INTERACTIVE_RESPONSE:
      try {
        const params = JSON.parse(
          messageData.nativeFlowResponseMessage?.paramsJson || "{}"
        );
        buttonId = params.id || "";
        displayText = params.title || params.display_text || params.id || "";
        responseType = "interactive";
      } catch (e) {
        console.warn("Failed to parse interactive response:", e);
        buttonId = "";
        displayText = "";
      }
      break;

    default:
      responseType = "none";
  }

  return { buttonId, displayText, type: responseType };
}

/**
 * Enhanced function to extract text content from various message types
 * @param {Object} message - Baileys message object
 * @returns {string} Extracted text content
 */
function extractTextContent(message) {
  if (!message) return "";

  // Priority 1: Check for button responses first
  const buttonResponseType = BUTTON_RESPONSE_TYPES.find(
    (type) => message[type]
  );
  if (buttonResponseType) {
    const buttonResponse = extractButtonResponse({
      [buttonResponseType]: message[buttonResponseType],
    });
    if (buttonResponse.buttonId) {
      return buttonResponse.buttonId;
    }
    if (buttonResponse.displayText) {
      return buttonResponse.displayText;
    }
  }

  // Priority 2: Check for regular text messages
  if (message.conversation) {
    return message.conversation;
  }

  if (message.extendedTextMessage?.text) {
    return message.extendedTextMessage.text;
  }

  // Priority 3: Check for media with captions
  const mediaTypes = [
    "imageMessage",
    "videoMessage",
    "documentMessage",
    "audioMessage",
  ];

  for (const mediaType of mediaTypes) {
    if (message[mediaType]?.caption) {
      return message[mediaType].caption;
    }
  }

  // Priority 4: Check for quoted messages
  const contextInfo =
    message.extendedTextMessage?.contextInfo ||
    message.imageMessage?.contextInfo ||
    message.videoMessage?.contextInfo;

  if (contextInfo?.quotedMessage) {
    const quotedText = extractTextContent(contextInfo.quotedMessage);
    if (quotedText) return quotedText;
  }

  return "";
}

/**
 * Enhanced function to extract comprehensive message content
 * @param {Object} msg - Baileys message object
 * @returns {Object} Extracted message information
 */
async function extractMessageContent(msg) {
  try {
    const message = msg.message;
    if (!message) {
      return {
        text: "",
        type: "unknown",
        hasMedia: false,
        isValid: false,
        isButtonResponse: false,
        buttonData: null,
        isContextInfo: false,
        isMixedMessage: false,
      };
    }

    const messageTypes = Object.keys(message);

    // Detect mixed messages (multiple message types in one object)
    const isMixedMessage = messageTypes.length > 1;

    // Check if this is only messageContextInfo (metadata only)
    const isContextInfo = messageTypes.includes(
      MESSAGE_TYPES.MESSAGE_CONTEXT_INFO
    );
    const isOnlyContextInfo = messageTypes.length === 1 && isContextInfo;

    // Priority: Check for button responses first
    let primaryType = "";
    let isButtonResponse = false;
    let buttonData = null;

    // Look for button response types with priority
    for (const btnType of BUTTON_RESPONSE_TYPES) {
      if (message[btnType]) {
        primaryType = btnType;
        isButtonResponse = true;
        buttonData = extractButtonResponse({ [btnType]: message[btnType] });
        break;
      }
    }

    // If no button response found, look for text messages
    if (!primaryType) {
      for (const textType of TEXT_MESSAGE_TYPES) {
        if (message[textType]) {
          primaryType = textType;
          break;
        }
      }
    }

    // If still no primary type, look for media
    if (!primaryType) {
      for (const mediaType of MEDIA_TYPES) {
        if (message[mediaType]) {
          primaryType = mediaType;
          break;
        }
      }
    }

    // Final fallback - use first available type
    if (!primaryType && messageTypes.length > 0) {
      primaryType =
        messageTypes.find(
          (type) => type !== MESSAGE_TYPES.MESSAGE_CONTEXT_INFO
        ) || messageTypes[0];
    }

    // Extract text content with enhanced button handling
    let text = "";
    if (isButtonResponse && buttonData?.buttonId) {
      // For button responses, prioritize buttonId over regular text extraction
      text = buttonData.buttonId;
    } else {
      text = extractTextContent(message).trim();
    }

    const hasMedia = MEDIA_TYPES.includes(primaryType);

    // Enhanced validity check
    const isValid =
      text.length > 0 ||
      hasMedia ||
      (isButtonResponse && buttonData?.buttonId) ||
      (!isOnlyContextInfo && messageTypes.length > 0);

    return {
      text,
      type: primaryType,
      hasMedia,
      isValid,
      isButtonResponse,
      buttonData,
      isContextInfo,
      isMixedMessage,
      isOnlyContextInfo,
      messageData: message[primaryType] || {},
      allMessageTypes: message,
    };
  } catch (error) {
    console.error("Error extracting message content:", error);
    return {
      text: "",
      type: "unknown",
      hasMedia: false,
      isValid: false,
      isButtonResponse: false,
      buttonData: null,
      isContextInfo: false,
      isMixedMessage: false,
      isOnlyContextInfo: false,
    };
  }
}

/**
 * Send message with typing indicator
 */
async function sendMessageWithTyping(messageContent, jid, sock, botLogger) {
  try {
    await sock.presenceSubscribe(jid);
    await delay(TYPING_DELAYS.SUBSCRIBE);

    await sock.sendPresenceUpdate("composing", jid);
    await delay(TYPING_DELAYS.COMPOSING);

    await sock.sendPresenceUpdate("paused", jid);
    await sock.sendMessage(jid, messageContent);
  } catch (error) {
    botLogger.error("Error sending message with typing:", error);
    throw error;
  }
}

async function downloadProfilePicture(sock, jid) {
  try {
    const ppUrl = await sock.profilePictureUrl(jid, "image");

    const response = await fetch(ppUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const savedFile = await fileManager.saveFile(
      buffer,
      `${jid.replace(/[@:\.]/g, "_")}.png`,
      "temp"
    );

    if (!savedFile.success) {
      throw new Error("Gagal menyimpan file: " + savedFile.error);
    }

    console.log(`✅ Profile picture downloaded for ${jid}`);
    return buffer;
  } catch (error) {
    console.error(`❌ Error downloading profile picture for ${jid}:`, error);
    return null;
  }
}

/**
 * Get group metadata with caching
 */
async function getGroupMetadata(groupJid, sock, groupCache, botLogger) {
  try {
    let groupMetadata = groupCache.get(groupJid);

    if (!groupMetadata) {
      groupMetadata = await sock.groupMetadata(groupJid);
      if (groupMetadata) {
        groupCache.set(groupJid, groupMetadata);
      }
    }

    return groupMetadata;
  } catch (error) {
    botLogger.warn(
      `Failed to get group metadata for ${groupJid}:`,
      error.message
    );
    return null;
  }
}

/**
 * Check if user is admin in group
 */
function isUserAdmin(participantId, groupMetadata) {
  if (!groupMetadata || !participantId) return false;

  const participant = groupMetadata.participants.find(
    (p) => p.id === participantId
  );
  return participant?.admin === "admin" || participant?.admin === "superadmin";
}

/**
 * Load commands from commands folder
 */
async function loadCommands(registry, botLogger) {
  try {
    const commandsPath = join(__dirname, "..", "commands");

    try {
      const commandFiles = readdirSync(commandsPath).filter(
        (file) => file.endsWith(".js") && !file.startsWith(".")
      );

      botLogger.info(`Loading ${commandFiles.length} command files...`);

      for (const file of commandFiles) {
        try {
          const commandPath = join(commandsPath, file);
          const commandModule = await import(`file://${commandPath}`);

          if (
            commandModule.default &&
            typeof commandModule.default === "function"
          ) {
            await commandModule.default(registry);
            botLogger.info(`✅ Loaded command from: ${file}`);
          } else if (
            commandModule.registerCommands &&
            typeof commandModule.registerCommands === "function"
          ) {
            await commandModule.registerCommands(registry);
            botLogger.info(`✅ Loaded commands from: ${file}`);
          } else {
            botLogger.warn(`⚠️ Invalid command file structure: ${file}`);
          }
        } catch (fileError) {
          console.log(fileError);
          botLogger.error(`❌ Error loading command file ${file}:`, fileError);
        }
      }

      botLogger.info(
        `✅ Successfully loaded commands from ${commandFiles.length} files`
      );
    } catch (dirError) {
      botLogger.warn(
        `Commands directory not found: ${commandsPath}. Creating default commands only.`
      );
    }
  } catch (error) {
    botLogger.error("Error loading commands:", error);
  }
}

/**
 * Process regular messages (non-commands)
 */
async function processRegularMessage(messageInfo) {
  const { botLogger, text, hasMedia, sender, isButtonResponse, buttonData } =
    messageInfo;

  try {
    if (isButtonResponse) {
      botLogger.debug(`🔘 Button response from ${sender}:`, {
        buttonId: buttonData?.buttonId,
        displayText: buttonData?.displayText,
        type: buttonData?.type,
      });
    } else {
      const logText = hasMedia
        ? "[Media Message]"
        : text?.substring(0, 100) + (text?.length > 100 ? "..." : "");

      botLogger.debug(`💬 Regular message from ${sender}: ${logText}`);
    }
  } catch (error) {
    botLogger.error("Error processing regular message:", error);
  }
}

/**
 * Main message processor (used by queue)
 */
export async function processMessageFromQueue(messageInfo) {
  const { botLogger, registry, text, isButtonResponse, buttonData } =
    messageInfo;

  try {
    // 1. Process commands first (highest priority)
    // Check if it's a command from text or button response
    const isCommand =
      text?.startsWith(registry.prefix) ||
      (isButtonResponse && buttonData?.buttonId?.startsWith(registry.prefix));

    if (isCommand) {
      // For button responses, ensure the text is set to buttonId for command processing
      if (isButtonResponse && buttonData?.buttonId) {
        messageInfo.text = buttonData.buttonId;
      }

      await registry.processMessage(messageInfo);
      return;
    }

    // 3. Process regular messages (including non-command button responses)
    await processRegularMessage(messageInfo);
  } catch (error) {
    botLogger.error(
      `Error in message queue processor for ${messageInfo.sender}:`,
      error
    );
    throw error;
  }
}

/**
 * Create optimized message handler with command loading
 */
export function createMessageHandler(
  sock,
  registry,
  botLogger,
  groupCache,
  queue
) {
  loadCommands(registry, botLogger).catch((error) => {
    botLogger.error("Failed to load commands:", error);
  });

  return async (update) => {
    try {
      if (!update.messages?.length) return;

      const messagePromises = update.messages.map((msg) =>
        handleIncomingMessage(sock, msg, registry, botLogger, groupCache, queue)
      );

      await Promise.allSettled(messagePromises);
    } catch (error) {
      botLogger.error("Error in message handler:", error);
    }
  };
}

/**
 * Enhanced handle incoming message with better button support
 */
export async function handleIncomingMessage(
  sock,
  msg,
  registry,
  botLogger,
  groupCache,
  queue
) {
  try {
    if (!msg || !msg.message || msg.key.fromMe) return;

    const sender = msg.key.remoteJid;
    sock.presenceSubscribe(sender);
    if (!sender) {
      botLogger.warn("Message ignored: invalid sender");
      return;
    }

    if (isJidNewsletter(sender)) {
      botLogger.debug("Newsletter message ignored");
      return;
    }

    const messageContent = await extractMessageContent(msg);

    // Skip invalid messages or pure messageContextInfo without other content
    if (!messageContent.isValid || messageContent.isOnlyContextInfo) {
      if (messageContent.isOnlyContextInfo) {
        botLogger.debug(
          `📋 Pure messageContextInfo from ${sender}: Skipping metadata-only message`
        );
      } else {
        botLogger.debug(`❌ Invalid/empty message from ${sender}: Skipping`);
      }
      return;
    }

    // Enhanced button response handling
    if (messageContent.isButtonResponse && messageContent.buttonData?.buttonId) {
      // For button responses, prioritize buttonId as the command text
      messageContent.text = messageContent.buttonData.buttonId;
      
      // Enhanced logging for button responses
      botLogger.info(`🔘 [BUTTON] from ${sender}: ${messageContent.buttonData.buttonId} (${messageContent.buttonData.type})`);
      
      // If buttonId looks like a command, ensure it's processed as such
      if (messageContent.text.startsWith(registry.prefix)) {
        // Transform button response to text message for proper command processing
        await appendTextMessage(
          sock, 
          { messages: [msg], type: "notify" }, 
          msg, 
          messageContent.text
        );
        return; // Let the transformed message be processed through normal flow
      }
    }

    // Enhanced logging for different message types
    let logPrefix;
    let logText;

    if (messageContent.hasMedia) {
      logPrefix = "📎 [MEDIA]";
      logText = `${messageContent.type} ${
        messageContent.text
          ? `with caption: "${messageContent.text.substring(0, 50)}..."`
          : "(no caption)"
      }`;
    } else if (messageContent.isButtonResponse) {
      logPrefix = "🔘 [BUTTON]";
      logText = `${messageContent.buttonData?.type || "unknown"}: ${messageContent.buttonData?.buttonId || "no-id"} | ${messageContent.buttonData?.displayText || "no-text"}`;
    } else if (
      messageContent.isContextInfo &&
      !messageContent.isOnlyContextInfo
    ) {
      logPrefix = "📋 [CONTEXT+TEXT]";
      logText =
        messageContent.text.substring(0, 50) +
        (messageContent.text.length > 50 ? "..." : "");
    } else {
      logPrefix = "💬 [TEXT]";
      logText =
        messageContent.text.substring(0, 50) +
        (messageContent.text.length > 50 ? "..." : "");
    }

    botLogger.info(`📨 ${logPrefix} from ${sender}: ${logText}`);

    // Determine message context
    const isGroup = sender.endsWith("@g.us");
    const participantId = msg.key.participant || msg.key.remoteJid;
    let isAdmin = false;

    if (isGroup) {
      const groupMetadata = await getGroupMetadata(
        sender,
        sock,
        groupCache,
        botLogger
      );
      isAdmin = isUserAdmin(participantId, groupMetadata);
    }

    // Create comprehensive message info object
    const messageInfo = {
      chat: msg.key.remoteJid, // JID tujuan chat sebenarnya
      sender, // ini sudah remoteJid (biar backward compat)
      participant: participantId,
      text: messageContent.text,
      message: msg.message,
      raw: msg,
      hasMedia: messageContent.hasMedia,
      messageType: messageContent.type,
      messageData: messageContent.messageData,
      isGroup,
      isAdmin,
      isButtonResponse: messageContent.isButtonResponse,
      isContextInfo: messageContent.isContextInfo,
      isMixedMessage: messageContent.isMixedMessage,
      buttonData: messageContent.buttonData,
      allMessageTypes: messageContent.allMessageTypes,
      mentions:
        msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [],
      sock,
      registry,
      botLogger,
      timestamp: msg.messageTimestamp,
      receivedAt: Date.now(),
    };

    // Determine queue priority
    let priority = "normal";
    const isCommand =
      messageContent.text?.startsWith(registry.prefix) ||
      (messageContent.isButtonResponse &&
        messageContent.buttonData?.buttonId?.startsWith(registry.prefix));

    // Check bot status and handle accordingly
    const whoIs = msg.key.participant || sender;
    const owners = config.NormalizeJid(whoIs);
    const stopped = await handleMessage(sock, owners, messageContent, registry);
    if (stopped) return;

    if (isCommand || messageContent.isButtonResponse) {
      priority = "high";
    }

    // Add to processing queue
    queue.enqueue(messageInfo, {
      isPremium: isAdmin,
      priority: priority,
    });
  } catch (error) {
    botLogger.error(`Error in handleIncomingMessage: ${error.message}`);
    console.log(error);
  }
}

// Export utility functions for external use
export {
  sendMessageWithTyping,
  extractMessageContent,
  extractTextContent,
  extractButtonResponse,
  getGroupMetadata,
  isUserAdmin,
  loadCommands,
  downloadProfilePicture,
};
