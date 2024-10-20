import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';
import { processMessage } from './aiService.js';
import { saveMessage, saveAIResponse, getRecentMessages } from './database.js';
import { setupCommands } from './commands.js';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

setupCommands(bot);

async function startBot() {
  try {
    const handleMessage = async (ctx) => {      
      const messageContext = {
        message: {
          id: ctx.message.message_id,
          date: new Date(ctx.message.date * 1000),
          text: ctx.message.text || ''
        },
        sender: {
          id: ctx.from.id,
          username: ctx.from.username,
          firstName: ctx.from.first_name,
          lastName: ctx.from.last_name
        },
        chat: {
          id: ctx.chat.id,
          type: ctx.chat.type,
          title: ctx.chat.title
        }
      };

      try {
        // Get recent messages for context
        const recentMessages = await getRecentMessages(messageContext.chat.id, 20);
        
        // Add recent messages to the context
        messageContext.recentMessages = recentMessages;

        // Save the user message to the database
        const savedMessageId = await saveMessage(
          messageContext.chat.id,
          messageContext.sender.id,
          messageContext.message.text,
          messageContext.chat.type,
          messageContext.chat.title,
          messageContext.sender.username,
          messageContext.sender.firstName,
          messageContext.sender.lastName
        );

        const assistantReplyObject = await processMessage(messageContext);
        
        // Extract the text from the assistantReplyObject
        const assistantReplyText = assistantReplyObject.text;
        
        // Save the AI response to the database
        if (savedMessageId) {
          const { interaction_id, response_id } = await saveAIResponse(savedMessageId, assistantReplyText);
          // You can now use interaction_id and response_id if needed
        } else {
          console.error('Failed to save user message, cannot save AI response');
        }
        
        // Send only the text of the response
        await ctx.reply(assistantReplyText);
      } catch (error) {
        console.error('Error saving message or processing with AI Agent:', error);
        await ctx.reply("I'm sorry, I encountered an error while processing your request.");
      }
    };

    // Use the handler for text messages only
    bot.on('text', handleMessage);

    // Load commands
    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Get update on things' },
      { command: 'history', description: 'Scan and save all chat messages' }
    ]);

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
