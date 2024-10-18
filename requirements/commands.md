# Commands for Telegram MEME Broker

## 1. Set up Command Handlers

In your main bot file (`bot.js`), set up the following command handlers:

```javascript:bot.js
import { Telegraf } from 'telegraf';
import { addMeme, getMemes, addVote, getLeaderboard } from './database.js';

const bot = new Telegraf(process.env.BOT_TOKEN);

// Start command
bot.command('start', (ctx) => {
  ctx.reply('Welcome to the MEME Broker! Use /help to see available commands.');
});

// Help command
bot.command('help', (ctx) => {
  ctx.reply(`
Available commands:
/addmeme - Add a new meme
/postmeme - Post a random meme to the chat
/vote - Vote on the last posted meme
/leaderboard - Show the meme leaderboard
  `);
});

// Add other command handlers here
```

## 2. Implement Add Meme Command

```javascript:bot.js
bot.command('addmeme', async (ctx) => {
  // Check if the message has a photo
  if (ctx.message.photo) {
    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    const meme = {
      fileId,
      addedBy: ctx.from.id,
      addedAt: new Date()
    };
    await addMeme(meme);
    ctx.reply('Meme added successfully!');
  } else {
    ctx.reply('Please send a photo with the /addmeme command.');
  }
});
```

## 3. Implement Post Meme Command

```javascript:bot.js
bot.command('postmeme', async (ctx) => {
  const memes = await getMemes();
  if (memes.length > 0) {
    const randomMeme = memes[Math.floor(Math.random() * memes.length)];
    await ctx.replyWithPhoto(randomMeme.fileId, {
      caption: 'Rate this meme! Use /vote [1-5] to vote.'
    });
  } else {
    ctx.reply('No memes available. Add some memes first!');
  }
});
```

## 4. Implement Vote Command

```javascript:bot.js
bot.command('vote', async (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length !== 2) {
    return ctx.reply('Please use the format: /vote [1-5]');
  }
  
  const vote = parseInt(args[1]);
  if (isNaN(vote) || vote < 1 || vote > 5) {
    return ctx.reply('Please provide a valid vote between 1 and 5.');
  }
  
  // Assuming the last message in the chat is the meme to be voted on
  const chat = await ctx.getChat();
  const messages = await ctx.telegram.getChatHistory(chat.id, { limit: 2 });
  const memeMessage = messages[1];
  
  if (memeMessage && memeMessage.photo) {
    const memeId = memeMessage.photo[memeMessage.photo.length - 1].file_id;
    await addVote(memeId, ctx.from.id, vote);
    ctx.reply('Your vote has been recorded!');
  } else {
    ctx.reply('No recent meme found to vote on.');
  }
});
```

## 5. Implement Leaderboard Command

```javascript:bot.js
bot.command('leaderboard', async (ctx) => {
  const leaderboard = await getLeaderboard();
  if (leaderboard.length > 0) {
    let message = 'Top 10 Memes:\n\n';
    for (let i = 0; i < leaderboard.length; i++) {
      message += `${i + 1}. Score: ${leaderboard[i].score}\n`;
    }
    ctx.reply(message);
  } else {
    ctx.reply('No votes recorded yet.');
  }
});
```

## 6. Set up Error Handling

```javascript:bot.js
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}`, err);
  ctx.reply('An error occurred. Please try again later.');
});
```

## 7. Launch the Bot

```javascript:bot.js
bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
```

These commands will allow users to interact with the MEME Broker bot, adding memes, posting random memes, voting on memes, and viewing the leaderboard. Make sure to integrate these commands with the database functions we created earlier.
