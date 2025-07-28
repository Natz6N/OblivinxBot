import fs from "fs/promises"; // ES Module
import { downloadProfilePicture } from "./messageClients.js";
import config from "../config.js";

// Enhanced Obx class with better functionality
class Obx {
  constructor(chat, from, isadmin, mentions, sock, logger) {
    this.chat = chat;
    this.from = from;
    this.isadmin = isadmin;
    this.mentions = mentions;
    this.sock = sock;
    this.logger = logger || console;
    this.commands = new Map();
    this.middleware = [];
    this.cooldowns = new Map();
  }

  // Register command with enhanced options
  cmd(config) {
    const {
      name,
      aliases = [],
      isadmin = false,
      isowner = false,
      isgroup = false,
      cooldown = 0,
      description = "",
      usage = "",
      category = "general",
      exec,
    } = config;

    if (!name || typeof exec !== "function") {
      throw new Error("Command name and exec function are required");
    }

    const command = {
      name: name.toLowerCase(),
      aliases: aliases.map((alias) => alias.toLowerCase()),
      isadmin,
      isowner,
      isgroup,
      cooldown,
      description,
      usage,
      category,
      exec,
    };

    // Register main command name
    this.commands.set(command.name, command);

    // Register aliases
    command.aliases.forEach((alias) => {
      this.commands.set(alias, command);
    });

    return this;
  }

  // Add middleware
  use(middleware) {
    if (typeof middleware === "function") {
      this.middleware.push(middleware);
    }
    return this;
  }

  // Find command
  findCommand(cmdName) {
    return this.commands.get(cmdName.toLowerCase());
  }

  // Check cooldown
  checkCooldown(command, userId) {
    const key = `${command.name}_${userId}`;
    const now = Date.now();
    const cooldownEnd = this.cooldowns.get(key);

    if (cooldownEnd && now < cooldownEnd) {
      const remaining = Math.ceil((cooldownEnd - now) / 1000);
      return { onCooldown: true, remaining };
    }

    // Set cooldown
    if (command.cooldown > 0) {
      this.cooldowns.set(key, now + command.cooldown * 1000);
    }

    return { onCooldown: false };
  }

  // Execute command with middleware support
  async execute(cmdName, args = [], messageInfo = {}) {
    const command = this.findCommand(cmdName);

    if (!command) {
      return { success: false, error: "Command not found" };
    }

    // Check permissions
    const permissionCheck = this.checkPermissions(command, messageInfo);
    if (!permissionCheck.allowed) {
      return { success: false, error: permissionCheck.reason };
    }

    // Check cooldown
    const cooldownCheck = this.checkCooldown(
      command,
      messageInfo.participant || messageInfo.sender
    );
    if (cooldownCheck.onCooldown) {
      return {
        success: false,
        error: `Command on cooldown. Wait ${cooldownCheck.remaining}s`,
      };
    }

    // Create context
    const context = {
      obx: this,
      args,
      messageInfo,
      chat: this.chat,
      from: this.from,
      isadmin: this.isadmin,
      mentions: this.mentions,
      sock: this.sock,
      logger: this.logger,
      reply: async (text, options = {}) => {
        return await this.sock.sendMessage(messageInfo.sender, {
          text: text,
          ...options,
        });
      },
      replyWithMention: async (text, options = {}) => {
        return await this.sock.sendMessage(messageInfo.sender, {
          text: `@${
            messageInfo.participant?.split("@")[0] ||
            messageInfo.sender.split("@")[0]
          } ${text}`,
          mentions: [messageInfo.participant || messageInfo.sender],
          ...options,
        });
      },
    };

    try {
      // Run middleware
      for (const middleware of this.middleware) {
        const result = await middleware(context);
        if (result === false) {
          return { success: false, error: "Blocked by middleware" };
        }
      }

      // Execute command
      await command.exec(context);
      return { success: true };
    } catch (error) {
      this.logger.error(`Error executing command ${cmdName}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Check command permissions
  checkPermissions(command, messageInfo) {
    const { isGroup, isAdmin, isOwner } = messageInfo;

    // Check if command requires group
    if (command.isgroup && !isGroup) {
      return {
        allowed: false,
        reason: "This command can only be used in groups",
      };
    }

    // Check if command requires admin
    if (command.isadmin && !isAdmin) {
      return {
        allowed: false,
        reason: "This command requires admin privileges",
      };
    }

    // Check if command requires owner
    if (command.isowner && !isOwner) {
      return {
        allowed: false,
        reason: "This command requires owner privileges",
      };
    }

    return { allowed: true };
  }

  // Get all commands
  getAllCommands() {
    const uniqueCommands = new Set();
    const commandList = [];

    this.commands.forEach((command) => {
      if (!uniqueCommands.has(command.name)) {
        uniqueCommands.add(command.name);
        commandList.push({
          name: command.name,
          aliases: command.aliases,
          isadmin: command.isadmin,
          isowner: command.isowner,
          isgroup: command.isgroup,
          description: command.description,
          usage: command.usage,
          category: command.category,
        });
      }
    });

    return commandList;
  }

  // Get commands by category
  getCommandsByCategory() {
    const categories = {};

    this.getAllCommands().forEach((cmd) => {
      const category = cmd.category || "general";
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(cmd);
    });

    return categories;
  }

  // Clear all commands
  clearCommands() {
    this.commands.clear();
    return this;
  }

  // Remove specific command
  removeCommand(name) {
    const command = this.commands.get(name.toLowerCase());
    if (command) {
      // Remove main command
      this.commands.delete(command.name);
      // Remove aliases
      command.aliases.forEach((alias) => {
        this.commands.delete(alias);
      });
      return true;
    }
    return false;
  }
}

// Enhanced Message Registry
class MessageRegistry {
  constructor(sock, logger, options = {}) {
    this.sock = sock;
    this.logger = logger || console;
    this.prefix = options.prefix || "!";
    this.ownerNumbers = options.owners || [];
    this.adminBypass = options.adminBypass || false;
    this.obxInstances = new Map();
    this.globalCommands = new Map();
    this.middleware = [];
    this.eventHandlers = new Map();

    // Performance tracking
    this.commandStats = new Map();
  }

  // Set command prefix
  setPrefix(prefix) {
    this.prefix = prefix;
    return this;
  }

  // Set owner numbers
  setOwners(numbers) {
    this.ownerNumbers = Array.isArray(numbers) ? numbers : [numbers];
    return this;
  }

  // Add global middleware
  use(middleware) {
    if (typeof middleware === "function") {
      this.middleware.push(middleware);
    }
    return this;
  }

  // Register event handler
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
    return this;
  }

  // Emit event
  async emit(event, data) {
    const handlers = this.eventHandlers.get(event) || [];
    for (const handler of handlers) {
      try {
        await handler(data);
      } catch (error) {
        this.logger.error(`Error in event handler for ${event}:`, error);
      }
    }
  }

  // Process incoming message with button response support
  async processMessage(messageInfo) {
    const startTime = Date.now();

    try {
      // Handle button response messages
      if (messageInfo.raw?.message?.buttonsResponseMessage?.selectedButtonId) {
        messageInfo.text =
          messageInfo.raw.message.buttonsResponseMessage.selectedButtonId;
        this.logger.info(`Button response detected: ${messageInfo.text}`);
      }

      // Handle list response messages (for future compatibility)
      if (
        messageInfo.raw?.message?.listResponseMessage?.singleSelectReply
          ?.selectedRowId
      ) {
        messageInfo.text =
          messageInfo.raw.message.listResponseMessage.singleSelectReply.selectedRowId;
        this.logger.info(`List response detected: ${messageInfo.text}`);
      }

      const { text, sender, isGroup } = messageInfo;

      if (!text || !text.startsWith(this.prefix)) return;

      // Extract command and arguments
      const args = text.slice(this.prefix.length).trim().split(/\s+/);
      const commandName = args.shift()?.toLowerCase();

      if (!commandName) return;

      // Emit command event
      await this.emit("command", { commandName, args, messageInfo });

      // Create or get Obx instance for this chat
      const obx = this.getObxInstance(sender, messageInfo);

      // Determine user permissions
      const isOwner = this.isOwner(messageInfo.participant || sender);
      const isAdmin = messageInfo.isAdmin || (this.adminBypass && isOwner);

      // Execute command
      const result = await obx.execute(commandName, args, {
        ...messageInfo,
        isOwner,
        isAdmin,
      });

      // Track command execution
      this.trackCommand(commandName, result.success, Date.now() - startTime);

      // Handle result
      if (!result.success) {
        await this.sock.sendMessage(sender, {
          text: `❌ ${result.error}`,
        });

        // Emit error event
        await this.emit("commandError", {
          commandName,
          error: result.error,
          messageInfo,
        });
      } else {
        // Emit success event
        await this.emit("commandSuccess", {
          commandName,
          messageInfo,
        });
      }
    } catch (error) {
      this.logger.error("Error processing message:", error);
      await this.emit("error", { error, messageInfo });
    }
  }

  // Track command statistics
  trackCommand(commandName, success, executionTime) {
    if (!this.commandStats.has(commandName)) {
      this.commandStats.set(commandName, {
        executions: 0,
        successes: 0,
        failures: 0,
        totalTime: 0,
        avgTime: 0,
      });
    }

    const stats = this.commandStats.get(commandName);
    stats.executions++;
    stats.totalTime += executionTime;
    stats.avgTime = stats.totalTime / stats.executions;

    if (success) {
      stats.successes++;
    } else {
      stats.failures++;
    }
  }

  // Get command statistics
  getCommandStats() {
    return Object.fromEntries(this.commandStats);
  }

  // Get or create Obx instance
  getObxInstance(chatId, messageInfo) {
    if (!this.obxInstances.has(chatId)) {
      const obx = new Obx(
        chatId,
        messageInfo.sender,
        messageInfo.isAdmin || false,
        messageInfo.mentions || [],
        this.sock,
        this.logger
      );

      // Apply global middleware
      this.middleware.forEach((middleware) => {
        obx.use(middleware);
      });

      // Register global commands
      this.globalCommands.forEach((command) => {
        obx.cmd(command);
      });

      // Register default commands
      this.registerDefaultCommands(obx);

      this.obxInstances.set(chatId, obx);
    }
    return this.obxInstances.get(chatId);
  }

  // Check if user is owner
  isOwner(jid) {
    const phoneNumber = jid?.split("@")[0];
    return this.ownerNumbers.includes(phoneNumber);
  }

  // Register default commands
  registerDefaultCommands(obx) {
    // Help command
    obx.cmd({
      name: "help",
      aliases: ["menu", "h"],
      description: "Show available commands",
      usage: `${this.prefix}help [category]`,
      category: "general",
      exec: async ({ args, messageInfo, reply, sock }) => {
        try {
          const { sender } = messageInfo;
          const categories = obx.getCommandsByCategory();
          const requestedCategory = args[0]?.toLowerCase();

          const names = messageInfo.raw.pushName;
          let helpText = `
Hallo *${names}* Trimakasih sudah menggunakan bot Kami. 
Jika terdapat bug atau bot macet hubungi Owner

*Bot Commands*
`;

          if (requestedCategory && categories[requestedCategory]) {
            // Show specific category
            helpText += `*${requestedCategory.toUpperCase()} Commands:*\n`;
            categories[requestedCategory].forEach((cmd) => {
              helpText += `> ${this.prefix}${cmd.name}`;
              if (cmd.description) {
                helpText += `\n  ${cmd.description}`;
              }
              helpText += "\n\n";
            });
          } else {
            // Show all categories
            Object.entries(categories).forEach(([category, commands]) => {
              // Filter commands based on permissions
              const visibleCommands = commands.filter((cmd) => {
                if (cmd.isowner && !messageInfo.isOwner) return false;
                if (cmd.isadmin && !messageInfo.isAdmin) return false;
                if (cmd.isgroup && !messageInfo.isGroup) return false;
                return true;
              });

              if (visibleCommands.length > 0) {
                helpText += `# *${category.toUpperCase()} Commands:*\n`;
                visibleCommands.forEach((cmd) => {
                  helpText += `> ${this.prefix}${cmd.name}`;
                  helpText += "\n";
                });
                helpText += "\n";
              }
            });

            helpText += `\nType ${this.prefix}help [category] for detailed info`;
          }

          // Send help message with interactive buttons
          await this.sock.sendMessage(
            sender,
            {
              text: helpText,
              buttons: [
                {
                  buttonId: `${this.prefix}ping`,
                  buttonText: { displayText: "🏓 Ping" },
                  type: 1,
                },
                {
                  buttonId: `${this.prefix}info`,
                  buttonText: { displayText: "ℹ️ Info" },
                  type: 1,
                },
                {
                  buttonId: `${this.prefix}help general`,
                  buttonText: { displayText: "📚 General Commands" },
                  type: 1,
                },
              ],
              headerType: 1,
            },
            { quoted: messageInfo.raw }
          );
        } catch (err) {
          console.log(err);
          // Fallback to simple text if buttons fail
          await reply(helpText);
        }
      },
    });

    // Ping command
    obx.cmd({
      name: "ping",
      aliases: ["p"],
      description: "Check bot response time",
      usage: `${this.prefix}ping`,
      category: "general",
      cooldown: 3,
      exec: async ({ reply, messageInfo }) => {
        const start = Date.now();
        const end = Date.now();

        setTimeout(async () => {
          await reply(`🏓 Pong!\n⏱️ Response time: ${end - start}ms`);
        }, 100);
      },
    });

    // Info command
    obx.cmd({
      name: "info",
      aliases: ["about", "bot"],
      description: "info bot",
      usage: `${this.prefix}info`,
      category: "general",
      exec: async ({ reply, messageInfo }) => {
        const { sender } = messageInfo;
        const commandCount = Math.floor(obx.commands.size / 2);
        const uptime = process.uptime();
        const Namesender = messageInfo.raw.pushName;
        const uptimeStr = `${Math.floor(uptime / 3600)}h ${Math.floor(
          (uptime % 3600) / 60
        )}m ${Math.floor(uptime % 60)}s`;

        const info = `🤖 Hi *${Namesender}* Berikut adalah informasi dari Bot
        
> Bot Name   : ${config.Botinfo.BotName}
> Version    : ${config.Botinfo.version}
> Uptime     : ${uptimeStr}
> command    : ${commandCount}
> prefix     : ${this.prefix}
> Author     : Natzsixn
> Repository : https://github.com/Natz6N/OblivinxBot

Type ${this.prefix}help to see available commands.`;

        try {
          await this.sock.sendMessage(
            sender,
            {
              image: {
                url: "./src/media/OblivinxLogo.png",
              },
              caption: info,
              buttons: [
                {
                  buttonId: `${this.prefix}help`,
                  buttonText: { displayText: "📋 Show Commands" },
                  type: 1,
                },
                {
                  buttonId: `${this.prefix}ping`,
                  buttonText: { displayText: "🏓 Test Ping" },
                  type: 1,
                },
              ],
              headerType: 4,
            },
            {
              quoted: messageInfo.raw,
            }
          );
        } catch (err) {
          console.log(err);
          // Fallback to simple image message
          await this.sock.sendMessage(
            sender,
            {
              image: {
                url: "./src/media/OblivinxLogo.png",
              },
              caption: info,
            },
            {
              quoted: messageInfo.raw,
            }
          );
        }
      },
    });

    // Changelog command
    obx.cmd({
      name: "changelog",
      description: "Show changelog",
      usage: `${this.prefix}changelog`,
      category: "owner",
      isowner: true,
      exec: async ({ reply }) => {
        try {
          const readfiles = await fs.readFile(
            "./src/Data/Changelog.txt",
            "utf-8"
          );
          let statsText = "📊 *Berikut adalah Changelog*\n\n" + readfiles;

          await reply(statsText);
        } catch (error) {
          await reply("❌ Error reading changelog file");
        }
      },
    });

    // Stats command
    obx.cmd({
      name: "stats",
      description: "Show command usage statistics",
      usage: `${this.prefix}stats`,
      category: "owner",
      isowner: true,
      exec: async ({ reply }) => {
        const stats = this.getCommandStats();
        let statsText = "📊 *Command Usage Statistics*\n\n";

        if (Object.keys(stats).length === 0) {
          statsText += "No command statistics available yet.";
        } else {
          Object.entries(stats)
            .sort(([, a], [, b]) => b.executions - a.executions)
            .forEach(([command, data]) => {
              statsText += `*${command}*\n`;
              statsText += `├─ Executions: ${data.executions}\n`;
              statsText += `├─ Success: ${data.successes}\n`;
              statsText += `├─ Failures: ${data.failures}\n`;
              statsText += `└─ Avg Time: ${data.avgTime.toFixed(2)}ms\n\n`;
            });
        }

        await reply(statsText);
      },
    });
    obx.cmd({
      name: "example",
      exec: async ({ sock, messageInfo }) => {
        await sock.sendMessage(messageInfo.sender, {
          text: "Choose an option:",
          buttons: [
            {
              buttonId: `${this.prefix}ping`,
              buttonText: { displayText: "🏓 Ping" },
              type: 1,
            },
            {
              buttonId: `${this.prefix}info`,
              buttonText: { displayText: "ℹ️ Info" },
              type: 1,
            },
          ],
          headerType: 1,
        });
      },
    });
  }

  // Add custom command globally
  addGlobalCommand(config) {
    this.globalCommands.set(config.name, config);

    // Add to existing instances
    this.obxInstances.forEach((obx) => {
      obx.cmd(config);
    });

    return this;
  }

  // Remove global command
  removeGlobalCommand(name) {
    this.globalCommands.delete(name);

    // Remove from existing instances
    this.obxInstances.forEach((obx) => {
      obx.removeCommand(name);
    });

    return this;
  }

  // Clear all instances (useful for restarts)
  clearInstances() {
    this.obxInstances.clear();
    return this;
  }

  // Check if message is button response
  isButtonResponse(messageInfo) {
    return !!(
      messageInfo.raw?.message?.buttonsResponseMessage?.selectedButtonId ||
      messageInfo.raw?.message?.listResponseMessage?.singleSelectReply
        ?.selectedRowId
    );
  }

  // Get response type
  getResponseType(messageInfo) {
    if (messageInfo.raw?.message?.buttonsResponseMessage) {
      return "button";
    }
    if (messageInfo.raw?.message?.listResponseMessage) {
      return "list";
    }
    return "text";
  }

  // Helper method to create button messages
  createButtonMessage(text, buttons, options = {}) {
    return {
      text,
      buttons: buttons.map((btn) => ({
        buttonId: btn.id,
        buttonText: { displayText: btn.text },
        type: 1,
      })),
      headerType: 1,
      ...options,
    };
  }

  // Helper method to create list messages
  createListMessage(text, title, buttonText, sections, options = {}) {
    return {
      text,
      buttonText,
      listType: 1,
      sections: sections.map((section) => ({
        title: section.title,
        rows: section.rows.map((row) => ({
          title: row.title,
          description: row.description || "",
          rowId: row.id,
        })),
      })),
      ...options,
    };
  }
}

// Export classes
export { Obx, MessageRegistry };
