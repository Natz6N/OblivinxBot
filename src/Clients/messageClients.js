import { isJidNewsletter } from "@whiskeysockets/baileys";
import { readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
};

const MEDIA_TYPES = [
  MESSAGE_TYPES.IMAGE,
  MESSAGE_TYPES.VIDEO,
  MESSAGE_TYPES.DOCUMENT,
  MESSAGE_TYPES.AUDIO,
  MESSAGE_TYPES.STICKER,
];

/**
 * Send message with typing indicator
 * @param {Object} messageContent - Message content to send
 * @param {string} jid - Recipient JID
 * @param {Object} sock - WhatsApp socket instance
 * @param {Object} botLogger - Logger instance
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

/**
 * Extract text content from various message types
 * @param {Object} message - Baileys message object
 * @returns {string} Extracted text content
 */
function extractTextContent(message) {
  if (!message) return "";

  const messageType = Object.keys(message)[0];
  const messageData = message[messageType];

  if (!messageData) return "";
 // Jika messageData langsung berupa string (contoh: conversation)
  if (typeof messageData === "string") return messageData;
  
  // Ekstrak dari berbagai tipe message yang umum digunakan
  const textSources = [
    messageData.text, // Untuk textMessage
    messageData.caption, // Untuk imageMessage, videoMessage
    messageData.conversation, // Untuk chat biasa
    messageData.selectedButtonId, // Untuk buttonsResponseMessage
    messageData.singleSelectReply?.selectedRowId, // Untuk listResponseMessage
    messageData.extendedTextMessage?.text, // Untuk extendedText
    messageData.contextInfo?.quotedMessage?.conversation, // Quoted basic
    messageData.contextInfo?.quotedMessage?.extendedTextMessage?.text, // Quoted extended
  ];
  console.log("Incoming message type:", Object.keys(message));
  console.log("Message data:", message[Object.keys(message)[0]]);

  return (
    textSources.find((text) => typeof text === "string" && text.trim()) || ""
  );
}

/**
 * Extract comprehensive message content
 * @param {Object} msg - Baileys message object
 * @returns {Object} Extracted message information
 */
async function extractMessageContent(msg) {
  try {
    const message = msg.message;
    console.log(message);
    if (!message) {
      return { text: "", type: "unknown", hasMedia: false, isValid: false };
    }

    const messageType = Object.keys(message)[0] || "unknown";
    const text = extractTextContent(message).trim();
    const hasMedia = MEDIA_TYPES.includes(messageType);
    const isValid = text.length > 0 || hasMedia;

    return {
      text,
      type: messageType,
      hasMedia,
      isValid,
      messageData: message[messageType] || {},
    };
  } catch (error) {
    console.error("Error extracting message content:", error);
    return { text: "", type: "unknown", hasMedia: false, isValid: false };
  }
}

/**
 * Get group metadata with caching
 * @param {string} groupJid - Group JID
 * @param {Object} sock - WhatsApp socket
 * @param {Map} groupCache - Group metadata cache
 * @param {Object} botLogger - Logger instance
 * @returns {Object|null} Group metadata or null
 */
async function getGroupMetadata(groupJid, sock, groupCache, botLogger) {
  try {
    // Check cache first
    let groupMetadata = groupCache.get(groupJid);

    if (!groupMetadata) {
      groupMetadata = await sock.groupMetadata(groupJid);
      if (groupMetadata) {
        // Cache with TTL (optional: implement cache expiration)
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
 * @param {string} participantId - Participant ID
 * @param {Object} groupMetadata - Group metadata
 * @returns {boolean} True if user is admin
 */
function isUserAdmin(participantId, groupMetadata) {
  if (!groupMetadata || !participantId) return false;

  const participant = groupMetadata.participants.find(
    (p) => p.id === participantId
  );
  return participant?.admin === "admin" || participant?.admin === "superadmin";
}

/**
 * FIXED: Load commands from commands folder
 * This function dynamically loads all command files from the commands directory
 * and registers them to the MessageRegistry
 * @param {Object} registry - MessageRegistry instance
 * @param {Object} botLogger - Logger instance
 */
async function loadCommands(registry, botLogger) {
  try {
    const commandsPath = join(__dirname, "..", "commands"); // Adjust path as needed
    // console.log(commandsPath)

    // Check if commands directory exists
    try {
      const commandFiles = readdirSync(commandsPath).filter(
        (file) => file.endsWith(".js") && !file.startsWith(".")
      );

      botLogger.info(`Loading ${commandFiles.length} command files...`);

      for (const file of commandFiles) {
        try {
          const commandPath = join(commandsPath, file);
          const commandModule = await import(`file://${commandPath}`);

          // Check if command has default export or named exports
          if (
            commandModule.default &&
            typeof commandModule.default === "function"
          ) {
            // If default export is a function, call it with registry
            await commandModule.default(registry);
            botLogger.info(`✅ Loaded command from: ${file}`);
          } else if (
            commandModule.registerCommands &&
            typeof commandModule.registerCommands === "function"
          ) {
            // If has registerCommands function
            await commandModule.registerCommands(registry);
            botLogger.info(`✅ Loaded commands from: ${file}`);
          } else {
            botLogger.warn(`⚠️ Invalid command file structure: ${file}`);
          }
        } catch (fileError) {
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
 * FIXED: Handle bot mentions in groups with improved logic
 * @param {Object} messageInfo - Message information object
 * @returns {boolean} True if mention was handled
 */
async function handleBotMention(messageInfo) {
  const { text, isGroup, sock, sender, botLogger, registry } = messageInfo;

  if (!isGroup || !text?.includes("@")) return false;

  const botNumber = sock.user?.id?.split(":")[0];
  if (!botNumber || !text.includes(`@${botNumber}`)) return false;

  try {
    await sendMessageWithTyping(
      {
        text: `👋 Halo! Ada yang bisa saya bantu?\nKetik ${registry.prefix}help untuk melihat perintah yang tersedia.`,
      },
      sender,
      sock,
      botLogger
    );

    botLogger.info(
      `Bot mentioned in group ${sender}, responded with help message`
    );
    return true;
  } catch (error) {
    botLogger.error("Error handling bot mention:", error);
    return false;
  }
}

/**
 * REMOVED: processCommand function - now handled directly by MessageRegistry
 * The command processing is now delegated to the MessageRegistry.processMessage method
 * which provides better integration with the command system
 */

/**
 * FIXED: Process regular messages (non-commands)
 * This function handles messages that are not commands
 * @param {Object} messageInfo - Message information object
 */
async function processRegularMessage(messageInfo) {
  const { botLogger, text, hasMedia, sender } = messageInfo;

  try {
    // Log non-command messages for debugging
    botLogger.debug(
      `Regular message from ${sender}: ${
        hasMedia
          ? "[Media]"
          : text?.substring(0, 50) + (text?.length > 50 ? "..." : "")
      }`
    );
  } catch (error) {
    botLogger.error("Error processing regular message:", error);
  }
}

/**
 * FIXED: Main message processor (used by queue)
 * Updated to work directly with MessageRegistry for command processing
 * @param {Object} messageInfo - Message information object
 */
export async function processMessageFromQueue(messageInfo) {
  const { botLogger, registry, text } = messageInfo;

  try {
    // 1. Process commands first (highest priority)
    // CHANGED: Direct integration with MessageRegistry
    if (text?.startsWith(registry.prefix)) {
      await registry.processMessage(messageInfo);
      return; // Stop processing if command was handled
    }

    // 2. Handle bot mentions in groups
    if (await handleBotMention(messageInfo)) {
      return; // Stop processing if mention was handled
    }

    // 3. Process regular messages
    await processRegularMessage(messageInfo);
  } catch (error) {
    botLogger.error(
      `Error in message queue processor for ${messageInfo.sender}:`,
      error
    );
    throw error; // Re-throw for queue retry mechanism
  }
}

/**
 * FIXED: Create optimized message handler with command loading
 * @param {Object} sock - WhatsApp socket
 * @param {Object} registry - Command registry
 * @param {Object} botLogger - Logger instance
 * @param {Map} groupCache - Group metadata cache
 * @param {Object} queue - Message queue
 * @returns {Function} Message handler function
 */
export function createMessageHandler(
  sock,
  registry,
  botLogger,
  groupCache,
  queue
) {
  // ADDED: Load commands when handler is created
  loadCommands(registry, botLogger).catch((error) => {
    botLogger.error("Failed to load commands:", error);
  });

  return async (update) => {
    try {
      if (!update.messages?.length) return;

      // Process messages concurrently for better performance
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
 * FIXED: Handle incoming message with improved integration
 * @param {Object} sock - WhatsApp socket
 * @param {Object} msg - Baileys message object
 * @param {Object} registry - Command registry
 * @param {Object} botLogger - Logger instance
 * @param {Map} groupCache - Group metadata cache
 * @param {Object} queue - Message queue
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
    // Early validation
    if (!msg.message || msg.key.fromMe) return;

    const sender = msg.key.remoteJid;
    console.log(sender);
    if (!sender) {
      botLogger.warn("Message ignored: invalid sender");
      return;
    }

    // Skip newsletter messages
    if (isJidNewsletter(sender)) {
      botLogger.debug("Newsletter message ignored");
      return;
    }

    // Extract message content
    const messageContent = await extractMessageContent(msg);

    if (!messageContent.isValid) {
      botLogger.debug(`Invalid/empty message ignored from: ${sender}`);
      return;
    }

    // Log incoming message
    botLogger.info(
      `📨 Incoming ${
        messageContent.hasMedia ? "[Media]" : "text"
      } from ${sender}: ${
        messageContent.text
          ? messageContent.text.substring(0, 50) +
            (messageContent.text.length > 50 ? "..." : "")
          : "[No text]"
      }`
    );

    // Determine message context
    const isGroup = sender.endsWith("@g.us");
    const participantId = msg.key.participant || msg.key.remoteJid;
    let isAdmin = false;

    // Get admin status for group messages
    if (isGroup) {
      const groupMetadata = await getGroupMetadata(
        sender,
        sock,
        groupCache,
        botLogger
      );
      isAdmin = isUserAdmin(participantId, groupMetadata);
    }

    // FIXED: Create comprehensive message info object with registry reference
    const messageInfo = {
      // Core message data
      sender,
      participant: participantId,
      text: messageContent.text,
      message: msg.message,
      raw: msg,

      // Message type info
      hasMedia: messageContent.hasMedia,
      messageType: messageContent.type,
      messageData: messageContent.messageData,

      // Context info
      isGroup,
      isAdmin,
      mentions:
        msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [],

      // System objects - ADDED registry reference
      sock,
      registry,
      botLogger,

      // Timestamps
      timestamp: msg.messageTimestamp,
      receivedAt: Date.now(),
    };

    // REMOVED: Direct command processing - now handled by queue
    // The queue will handle both command and non-command messages appropriately

    // Add to processing queue
    queue.enqueue(messageInfo, {
      isPremium: isAdmin, // Prioritize admin messages
      priority: messageContent.text?.startsWith(registry.prefix)
        ? "high"
        : "normal",
    });
  } catch (error) {
    botLogger.error("Error handling incoming message:", error);
  }
}

// Export utility functions for external use
export {
  sendMessageWithTyping,
  extractMessageContent,
  getGroupMetadata,
  isUserAdmin,
  loadCommands, // ADDED: Export loadCommands for manual usage
};
