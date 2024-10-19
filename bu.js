import dotenv from 'dotenv';
import { Telegraf, session } from 'telegraf';
import { initializeDatabase } from './database.js';
import { setupCommands } from './commands.js';
// import { setupMessageHandlers } from './messageHandlers.js';
// import { createStage } from './lib/navigation.js';
import { generateWelcomeMessage } from './lib/aiWelcome.js';
import { Groq } from 'groq-sdk';
import { createAIAgent } from './aiAgent.js';


dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const groq = new Groq(process.env.GROQ_API_KEY);

async function startBot() {
  try {
    await initializeDatabase();

    bot.use(session());

    const commandsComposer = setupCommands(bot);
    bot.use(commandsComposer);
    console.log('Commands set up');

    const aiAgent = createAIAgent(groq);

    // Add this logging middleware
    bot.use((ctx, next) => {
      console.log('Received update:', ctx.update);
      return next();
    });

    // Modify the text handler to include error logging
    bot.on('text', async (ctx) => {
      console.log('Received text message:', ctx.message.text);
      if (!ctx.message.text.startsWith('/')) {
        const userMessage = ctx.message.text;
        try {
          console.log('Processing message with AI agent');
          const assistantReply = await aiAgent.processMessage(userMessage, ctx.from);
          console.log('AI agent response:', assistantReply);
          await ctx.reply(assistantReply);
        } catch (error) {
          console.error('Error with AI Agent:', error);
          await ctx.reply("I'm sorry, I encountered an error while processing your request.");
        }
      }
    });

    // Add a general error handler
    bot.catch((err, ctx) => {
      console.error(`Error for ${ctx.updateType}:`, err);
    });

    // Update the newChatMembers event handler
    bot.on('chat_member', async (ctx) => {
      if (ctx.chatMember.new_chat_member.status === 'member') {
        const chatId = ctx.chat.id;
        const newMember = ctx.chatMember.new_chat_member.user;
        
        if (newMember.username !== bot.botInfo.username) {
          const groupName = ctx.chat.title || "this awesome group";
          const welcomeMessage = await generateWelcomeMessage(groupName);
          await ctx.telegram.sendMessage(chatId, welcomeMessage);
        }
      }
    });

    // Add this near other bot event handlers
    bot.on('channel_post', async (ctx) => {
      const channelId = ctx.channelPost.chat.id;
      const messageText = ctx.channelPost.text;

      // Check if the bot is an admin in the channel
      const botMember = await ctx.telegram.getChatMember(channelId, ctx.botInfo.id);
      if (botMember.status === 'administrator') {
        if (messageText && messageText.startsWith('/')) {
          // Handle channel commands
          await handleChannelCommand(ctx, channelId, messageText);
        } else {
          // Process regular channel posts
          await processChannelPost(ctx, channelId, messageText);
        }
      }
      }
    );

    bot.command('start', async (ctx) => {
      if (ctx.chat.type === 'private') {
        await ctx.reply('Welcome! To set up the bot for a channel, please use the /setup command.');
      }
    });

    bot.command('setup', async (ctx) => {
      if (ctx.chat.type === 'private') {
        await ctx.reply('Please send me the @username or ID of the channel you want to configure.');
        // Set user state to await channel input
        ctx.session.awaitingChannelInput = true;
      }
    });

    bot.on('text', async (ctx) => {
      if (ctx.chat.type === 'private' && ctx.session.awaitingChannelInput) {
        const channelIdentifier = ctx.message.text;
        // Verify if the bot is an admin in the specified channel
        try {
          const chatMember = await ctx.telegram.getChatMember(channelIdentifier, ctx.botInfo.id);
          if (chatMember.status === 'administrator') {
            // Bot is an admin, proceed with setup
            await setupBotForChannel(ctx, channelIdentifier);
          } else {
            await ctx.reply('I am not an administrator in this channel. Please add me as an admin and try again.');
          }
        } catch (error) {
          await ctx.reply('Unable to access the specified channel. Please make sure the channel exists and I have been added as an admin.');
        }
        ctx.session.awaitingChannelInput = false;
      }
    });

    async function setupBotForChannel(ctx, channelIdentifier) {
      await ctx.reply(`Setting up the bot for channel ${channelIdentifier}. Please choose an option:`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Set Reply Probability", callback_data: "set_prob" }],
            [{ text: "Set Custom Prompt", callback_data: "set_prompt" }],
            [{ text: "Toggle Replies", callback_data: "toggle_replies" }]
          ]
        }
      });
      // Store the channel being configured in the user's session
      ctx.session.configuringChannel = channelIdentifier;
    }

    async function handleChannelCommand(ctx, channelId, command) {
      switch (command) {
        case '/setup':
          await ctx.reply('Please configure the bot in a private message.');
          break;
        // Add more channel-specific commands as needed
      }
    }

    async function processChannelPost(ctx, channelId, messageText) {
      const config = aiAgent.getChannelConfig(channelId);
      
      if (!config.allowReplies) {
        console.log(`Replies are not allowed in channel ${channelId}`);
        return;
      }

      if (Math.random() > config.replyProbability) {
        console.log(`Skipping reply for channel ${channelId} based on probability`);
        return;
      }

      const assistantReply = await aiAgent.processChannelPost(messageText, channelId);
      await ctx.reply(assistantReply);
    }

    bot.action('set_prob', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply('Please enter the reply probability (0-1):');
      ctx.session.awaitingInput = 'probability';
    });

    bot.action('set_prompt', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply('Please enter the custom prompt for this channel:');
      ctx.session.awaitingInput = 'prompt';
    });

    bot.action('toggle_replies', async (ctx) => {
      await ctx.answerCbQuery();
      const channelId = ctx.session.configuringChannel;
      const config = aiAgent.getChannelConfig(channelId);
      config.allowReplies = !config.allowReplies;
      aiAgent.setChannelConfig(channelId, config);
      await ctx.reply(`Replies are now ${config.allowReplies ? 'enabled' : 'disabled'} for this channel.`);
    });

    bot.on('text', async (ctx) => {
      if (ctx.session.awaitingInput) {
        const channelId = ctx.session.configuringChannel;
        const config = aiAgent.getChannelConfig(channelId);
        
        switch (ctx.session.awaitingInput) {
          case 'probability':
            config.replyProbability = parseFloat(ctx.message.text);
            break;
          case 'prompt':
            config.customPrompt = ctx.message.text;
            break;
        }
        
        aiAgent.setChannelConfig(channelId, config);
        await ctx.reply(`Configuration updated for channel ${channelId}`);
        ctx.session.awaitingInput = null;
      }
    });

    // Modify the launch method to include error handling
    await bot.launch().then(() => {
      console.log('Bot is running...');
    }).catch((error) => {
      console.error('Error launching bot:', error);
    });
  } catch (error) {
    console.error('Error starting bot:', error);
  }
}

startBot();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Log the chat ID for each incoming message
bot.on('message', (ctx) => {
  const chatId = ctx.chat.id;
  const title = ctx.chat.title;
  console.log(`Bot is in ${title} with ID: ${chatId}`);
});
