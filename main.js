import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';
import { Groq } from 'groq-sdk';
import { createAIAgent } from './aiAgent.js';
import { saveMessage, saveAIResponse } from './database.js';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const groq = new Groq(process.env.GROQ_API_KEY);

async function startBot() {
  try {
    const trackMessage = (ctx) => {
      console.log('Raw message:', ctx.message);
      const message = ctx.message;
      const sender = ctx.from;
      const chat = ctx.chat;
      
      console.log('Message tracked:', {
        messageId: message.message_id,
        text: message.text,
        sender: {
          id: sender.id,
          username: sender.username,
          firstName: sender.first_name,
          lastName: sender.last_name
        },
        chat: {
          id: chat.id,
          type: chat.type,
          title: chat.title
        },
        date: new Date(message.date * 1000)
      });
    };

    const aiAgent = createAIAgent(groq);

    const handleMessage = async (ctx) => {
      trackMessage(ctx);
      
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
        // Save the user message to the database and vector store
        const savedMessageId = await saveMessage(
          messageContext.chat.id,
          messageContext.sender.id,
          messageContext.message.text,
          messageContext.chat.type,
          messageContext.chat.title
        );

        const assistantReplyObject = await aiAgent.processMessage(messageContext);
        
        // Extract the text from the assistantReplyObject
        const assistantReplyText = assistantReplyObject.text;
        
        // Save the AI response to the database
        await saveAIResponse(savedMessageId, assistantReplyText);
        
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
