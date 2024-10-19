import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';
import { processMessage } from './aiService.js';
import { saveMessage, saveAIResponse } from './database.js';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

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
          await saveAIResponse(savedMessageId, assistantReplyText);
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

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
// Log the chat ID for each incoming message
bot.on('message', (ctx) => {
  const chatId = ctx.chat.id;
  const title = ctx.chat.title;
  console.log(`Bot is in ${title} with ID: ${chatId}`);
});

