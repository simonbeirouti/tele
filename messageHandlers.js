import { saveChat } from './database.js';

export function setupMessageHandlers(bot, showMessagesOnLoad) {
  bot.on('message', async (ctx) => {
    // Ignore commands, they're handled in main.js
    if (ctx.message.text && ctx.message.text.startsWith('/')) {
      return;
    }

    const chatId = ctx.chat.id;
    const userId = ctx.from.id;
    const username = ctx.from.username || 'Unknown';
    const userMessage = ctx.message.text || 'Non-text message';
    const chatType = ctx.chat.type;

    // Save the user's message to the database
    await saveChat(chatId, userId, username, userMessage, chatType);

    // If showMessagesOnLoad is false, delete non-command messages immediately
    if (!showMessagesOnLoad) {
      try {
        await ctx.deleteMessage(ctx.message.message_id);
      } catch (error) {
        console.error('Error deleting message:', error);
      }
    }
  });
}
