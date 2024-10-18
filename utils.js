export async function deleteMessage(ctx, message, delay = 2000) {
  setTimeout(async () => {
    try {
      await ctx.deleteMessage(message.message_id);
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  }, delay);
}
