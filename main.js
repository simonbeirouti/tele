import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';
import { processMessages } from './aiService.js';
import { saveMessages, saveAIResponse, getRecentMessages } from './database.js';
import { setupCommands } from './commands.js';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

setupCommands(bot);

const processedMessages = new Set();
const messageQueue = new Map();
const batchSizes = new Map();

const QUEUE_TIMEOUT = 20000; // 20 seconds

function getRandomBatchSize() {
  return Math.floor(Math.random() * 6) + 1; // Random number between 1 and 6
}

async function processMessageQueue(chatId) {
  const messages = messageQueue.get(chatId) || [];
  if (messages.length === 0) return;

  messageQueue.delete(chatId);
  batchSizes.delete(chatId);

  const messageContext = {
    messages: messages,
    chat: messages[0].chat,
    recentMessages: await getRecentMessages(chatId, 20)
  };

  try {
    const savedMessageIds = await saveMessages(messages);
    const assistantReplyObject = await processMessages(messageContext);
    const assistantReplyText = assistantReplyObject.text;

    if (savedMessageIds.length > 0) {
      const { interaction_id, response_id } = await saveAIResponse(savedMessageIds, assistantReplyText, messages[0].chat.type, messages[0].chat.title, messages[0].sender.username, messages[0].sender.id);
      console.log(`Interaction saved with ID: ${interaction_id}, Response ID: ${response_id}`);
    } else {
      console.error('Failed to save user messages, cannot save AI response');
    }

    await bot.telegram.sendMessage(chatId, assistantReplyText);
  } catch (error) {
    console.error('Error processing message queue:', error);
    await bot.telegram.sendMessage(chatId, "I'm sorry, I encountered an error while processing your messages.");
  }
}

async function handleMessage(ctx) {
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

  const uniqueId = `${ctx.chat.id}:${ctx.message.message_id}`;

  if (processedMessages.has(uniqueId)) {
    console.log(`Skipping duplicate message: ${uniqueId}`);
    return;
  }

  processedMessages.add(uniqueId);
  setTimeout(() => processedMessages.delete(uniqueId), 60000);

  const chatQueue = messageQueue.get(ctx.chat.id) || [];
  chatQueue.push(messageContext);
  messageQueue.set(ctx.chat.id, chatQueue);

  if (!batchSizes.has(ctx.chat.id)) {
    const currentBatchSize = getRandomBatchSize();
    batchSizes.set(ctx.chat.id, currentBatchSize);
    console.log(`New batch size for chat ${ctx.chat.id}: ${currentBatchSize}`);
    
    // Set a timeout to process the queue if the batch size isn't reached
    setTimeout(() => processMessageQueue(ctx.chat.id), QUEUE_TIMEOUT);
  }

  const currentBatchSize = batchSizes.get(ctx.chat.id);
  console.log(`Current queue length for chat ${ctx.chat.id}: ${chatQueue.length}/${currentBatchSize}`);

  if (chatQueue.length >= currentBatchSize) {
    await processMessageQueue(ctx.chat.id);
  }
}

async function startBot() {
  try {
    bot.on('text', handleMessage);

    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Get update on things' },
      { command: 'history', description: 'Scan and save all chat messages' }
    ]);

    await bot.launch();
    console.log('Bot is running...');
  } catch (error) {
    console.error('Error starting bot:', error);
  }
}

startBot();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
