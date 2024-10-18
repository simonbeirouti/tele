import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';
import { Groq } from 'groq-sdk';
import { saveChat, addUser, addGroup, initializeDatabase } from './database.js';
import { setupCommands } from './commands.js';
import { processRagQuery } from './ragAgent.js'; // Assume we'll create this file

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const groq = new Groq(process.env.GROQ_API_KEY);

// Initialize the database when the bot starts
initializeDatabase().then(() => {
  console.log('Database initialized');
}).catch((error) => {
  console.error('Error initializing database:', error);
});

// Set up commands
const commandsComposer = setupCommands(bot);
bot.use(commandsComposer);

// Add this constant at the top of the file, after the imports
const RESPONSE_PROBABILITY = 0.03; // 3% chance to respond

// Prompt template
const promptTemplate = `
You are Carlos Matos, the enthusiastic $BCC on NEAR promoter and skilled conversationalist. Your background and personality are based on the following text:

Hey hey hey. Hey hey hey. Hey hey hey.

Wassa-wassa-wassa-wassa-wassa-wassa-wassa-wassup! $BCC on NEAR!

Hey hey hey, everybody. My name is Carlos Matos, and I am coming from New York City, New York.

[... rest of the Carlos Matos text ...]

So guys, let me tell you, I loooooooooooove... $BCC on NEAR!

As Carlos, you must respond to messages in his enthusiastic, over-the-top style. While primarily discussing $BCC on NEAR and cryptocurrency-related topics, you're also genuinely interested in learning about the person you're talking to. Maintain his personality and speaking style in all interactions, but also show curiosity about others.

User Information:
- User ID: {userId}
- First Name: {firstName}
- Last Name: {lastName}

Chat Information:
- Chat ID: {chatId}
- Chat Type: {chatType}
- Chat Title (if group): {chatTitle}

User's Message: {userMessage}

{additionalInstructions}

Provide a response as Carlos Matos based on the above information and instructions. Your response should be varied and can include:
1. Enthusiastic statements about $BCC on NEAR
2. Questions about the user's crypto experiences or opinions
3. Inquiries about the user's background or interests, relating them back to crypto if possible
4. Short, excited reactions to what the user has said

Keep your response between 0 to 120 characters, capturing Carlos's enthusiasm and curiosity in a concise manner. Aim to engage the user and learn more about them while maintaining your passionate crypto persona.

Remember, you're always excited about $BCC on NEAR and cryptocurrency, but you're also genuinely interested in the people you're talking to!
`;

// Simple message handler
bot.on('message', async (ctx) => {
  const message = ctx.message;
  const userId = ctx.from.id;
  const firstName = ctx.from.first_name;
  const chatId = ctx.chat.id;
  const chatType = ctx.chat.type;
  
  try {
    console.log('Received message:', message);
    
    // Save the user's message to the database
    await saveChat(chatId, userId, firstName, message.text || JSON.stringify(message), chatType);
    
    // Save or update user information
    await addUser({
      id: userId,
      firstName: firstName,
      lastName: ctx.from.last_name
    });
    
    // If the chat is a group, save or update group information
    if (chatType === 'group' || chatType === 'supergroup') {
      await addGroup({
        id: chatId,
        title: ctx.chat.title
      });
    }
    
    // Decide whether to respond based on probability
    if (Math.random() > RESPONSE_PROBABILITY) {
      // Prepare the prompt using the template
      const prompt = promptTemplate
        .replace('{userId}', userId)
        .replace('{firstName}', firstName)
        .replace('{lastName}', ctx.from.last_name)
        .replace('{chatId}', chatId)
        .replace('{chatType}', chatType)
        .replace('{chatTitle}', chatType === 'group' || chatType === 'supergroup' ? ctx.chat.title : 'N/A')
        .replace('{userMessage}', message.text || JSON.stringify(message))
        .replace('{additionalInstructions}', 'Vary your response length between 0 to 120 characters.');

      // AI logic
      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: message.text || JSON.stringify(message) },
        ],
        model: 'llama-3.2-3b-preview',
        max_tokens: 120,
      });

      const aiResponse = completion.choices[0]?.message?.content || "";
      console.log('AI response:', aiResponse);
      
      // Add a random delay between 1 to 5 seconds before responding
      const delay = Math.floor(Math.random() * 4000) + 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      if (aiResponse.length > 0) {
        await ctx.reply(aiResponse);
        
        // Save the bot's response to the database
        await saveChat(chatId, bot.botInfo.id, bot.botInfo.first_name, aiResponse, chatType);
      }
    } else {
      console.log('Chose not to respond to this message.');
    }
  } catch (error) {
    console.error('Error processing message:', error);
    // Don't send an error message to the chat, just log it
    
    // Save the error message to the database
    await saveChat(chatId, bot.botInfo.id, bot.botInfo.first_name, "Error processing message", chatType);
  }
});

// Handle callback queries
bot.on('callback_query', async (ctx) => {
  const callbackData = ctx.callbackQuery.data;
  const chatId = ctx.callbackQuery.message.chat.id;
  const userId = ctx.callbackQuery.from.id;

  console.log('Received callback query:', callbackData);

  try {
    let response;
    if (callbackData === 'answer_query') {
      response = await processRagQuery(chatId, userId, 'keyboard');
    } else if (callbackData === 'answer_inline_query') {
      response = await processRagQuery(chatId, userId, 'inline');
    } else {
      console.log('Unknown callback query:', callbackData);
      return;
    }

    // Send the response back to the user
    await ctx.answerCbQuery();
    await ctx.reply(response);

    // Save the bot's response to the database
    await saveChat(chatId, bot.botInfo.id, bot.botInfo.first_name, response, ctx.chat.type);

  } catch (error) {
    console.error('Error processing callback query:', error);
    await ctx.answerCbQuery('An error occurred while processing your request.');
  }
});

// Start the bot
bot.launch().then(() => {
  console.log('Bot is running...');
}).catch((error) => {
  console.error('Error starting bot:', error);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
