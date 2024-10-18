import { Composer } from 'telegraf';
// import { generateWelcomeMessage } from './lib/aiWelcome.js';
import { getInlineKeyboard } from './lib/getInlineKeyboard.js';
import { getChatHistory, getChatHistoryBatch } from './database.js';

export function setupCommands(bot) {
	const composer = new Composer();

	composer.command('start', async (ctx) => {
		const userName = ctx.from.first_name || 'there';
		// const welcomeMessage = await generateWelcomeMessage(userName);
		const welcomeMessage = `Hey hey hey, ${userName}! Wassa-wassa-wassa-wassa-wassa-wassa-wassa-wassup! BitConnect!`
		await ctx.reply(welcomeMessage);
	});

	composer.command('help', async (ctx) => {
		const helpText = 'Welcome to the bot! Here are the available options:';
		const mainMenuKeyboard = getInlineKeyboard();
		await ctx.reply(helpText, mainMenuKeyboard);
	});

	// Comment out other commands for now
	/*
	composer.command('menu', (ctx) => ctx.scene.enter('mainMenu'));

	composer.command('addmeme', async (ctx) => {
		if (ctx.message.photo) {
			const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
			const meme = { fileId, addedBy: ctx.from.id };
			await addMeme(meme);
			await ctx.reply('Meme added successfully!');
		} else {
			await ctx.reply('Please send a photo with the /addmeme command.');
		}
	});

	composer.command('postmeme', async (ctx) => {
		const memes = await getMemes();
		if (memes.length > 0) {
			const randomMeme = memes[Math.floor(Math.random() * memes.length)];
			await ctx.replyWithPhoto(randomMeme.fileId, {
				caption: 'Rate this meme! Use /vote [1-5] to vote.',
			});
		} else {
			await ctx.reply('No memes available. Add some memes first!');
		}
	});

	composer.command('vote', async (ctx) => {
		const args = ctx.message.text.split(' ');
		if (args.length !== 2) {
			await ctx.reply('Please use the format: /vote [1-5]');
		} else {
			const vote = parseInt(args[1]);
			if (isNaN(vote) || vote < 1 || vote > 5) {
				await ctx.reply('Please provide a valid vote between 1 and 5.');
			} else {
				const chat = await ctx.getChat();
				const messages = await ctx.telegram.getChatHistory(chat.id, { limit: 2 });
				const memeMessage = messages[1];
				
				if (memeMessage && memeMessage.photo) {
					const memeId = memeMessage.photo[memeMessage.photo.length - 1].file_id;
					await addVote(memeId, ctx.from.id, vote);
					await ctx.reply('Your vote has been recorded!');
				} else {
					await ctx.reply('No recent meme found to vote on.');
				}
			}
		}
	});

	composer.command('leaderboard', async (ctx) => {
		const leaderboard = await getLeaderboard();
		if (leaderboard.length > 0) {
			let messageText = '*Top 10 Memes:*\n\n';
			for (let i = 0; i < leaderboard.length; i++) {
				// Escape special characters for MarkdownV2
				const escapedScore = leaderboard[i].score.toString().replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
				messageText += `${i + 1}\\. Score: ${escapedScore}\n`;
			}
			await ctx.replyWithMarkdownV2(messageText);
		} else {
			await ctx.reply('No votes recorded yet.');
		}
	});
	*/

	composer.command('n8n', async (ctx) => {
		await ctx.reply('Welcome to the n8n command! What would you like to do?', {
			reply_markup: {
				inline_keyboard: [
					[{ text: "Run Workflow", callback_data: "run_workflow" }],
					[{ text: "Check Status", callback_data: "check_status" }],
					[{ text: "Help", callback_data: "n8n_help" }]
				]
			}
		});
	});

	composer.command('chathistory', async (ctx) => {
		try {
			const history = await getChatHistory(10); // Get last 10 messages
			let messageText = 'Chat History:\n\n';
			for (const entry of history) {
				const date = new Date(entry.timestamp).toLocaleString();
				messageText += `[${date}] ${entry.username}: ${entry.message}\n\n`;
			}
			await ctx.reply(messageText);
		} catch (error) {
			console.error('Error fetching chat history:', error);
			await ctx.reply('Sorry, there was an error fetching the chat history.');
		}
	});

	composer.command('scanchat', async (ctx) => {
		const chatId = ctx.chat.id;
		const batchSize = 100;
		let offset = 0;
		let messageCount = 0;
		let hasMore = true;

		await ctx.reply('Starting chat scan. This may take a while...');

		while (hasMore) {
			const batch = await getChatHistoryBatch(chatId, offset, batchSize);
			messageCount += batch.length;
			offset += batchSize;

			if (batch.length < batchSize) {
				hasMore = false;
			}

			// Provide progress update every 1000 messages
			if (messageCount % 1000 === 0) {
				await ctx.reply(`Scanned ${messageCount} messages so far...`);
			}
		}

		await ctx.reply(`Chat scan complete. Total messages scanned: ${messageCount}`);
	});

	return composer;
}
