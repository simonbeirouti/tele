import {getRecentMessages, saveBulkMessages} from "./database.js";
import {searchVectorStore} from "./aiService.js";
import {TelegramClient} from "telegram";
import {StringSession} from "telegram/sessions/index.js";
import dotenv from "dotenv";
dotenv.config();

// You'll need to set up your API ID, API Hash, and bot token
const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const botToken = process.env.TELEGRAM_BOT_TOKEN;

const client = new TelegramClient(
	new StringSession(process.env.TELEGRAM_STRING_SESSION || ""),
	apiId,
	apiHash,
	{
		connectionRetries: 5,
	}
);

await client.start({
	botAuthToken: botToken,
});

export function setupCommands(bot) {
	bot.command("start", async (ctx) => {
		const chatId = ctx.chat.id;
		const limit = 50; // Number of recent messages to fetch
		let messageCount = 0;

		await ctx.reply("Fetching chat history. This may take a moment...");

		try {
			// Fetch recent messages from the database
			let recentMessages = await getRecentMessages(chatId, limit);
			messageCount = recentMessages.length;

			// If we don't have enough messages in the database, fetch from Telegram
			if (messageCount < limit) {
				const telegramMessages = await fetchTelegramHistory(
					ctx,
					limit - messageCount
				);
				recentMessages = [...telegramMessages, ...recentMessages];
				messageCount = recentMessages.length;
			}

			// Prepare the context for vector search
			const searchContext = recentMessages
				.map((msg) => `${msg.username || "User"}: ${msg.text}`)
				.join("\n");

			// Perform vector search
			const {results: relevantContext} = await searchVectorStore(
				"Recent chat history",
				searchContext,
				15,
				chatId
			);

			// Prepare the response
			let response = `Chat History Summary (Last ${messageCount} messages):\n\n`;
			recentMessages.forEach((msg, index) => {
				response += `${index + 1}. ${msg.username || "User"}: ${
					msg.text
				}\n`;
			});

			if (relevantContext.length > 0) {
				response += "\nRelevant Context from Vector Store:\n";
				relevantContext.forEach((item, index) => {
					response += `${index + 1}. ${item.metadata.content}\n`;
				});
			}

			// Send the response in chunks if it's too long
			if (response.length > 4096) {
				const chunks = response.match(/.{1,4096}/g);
				for (const chunk of chunks) {
					await ctx.reply(chunk);
				}
			} else {
				await ctx.reply(response);
			}
		} catch (error) {
			console.error("Error fetching chat history:", error);
			await ctx.reply("How's it goin?");
		}
	});

	//     bot.command('history', async (ctx) => {
	//         const chatId = ctx.chat.id;

	//         try {
	//             await ctx.reply('Fetching chat history for this channel. This may take a while...');

	//             const messages = await fetchEntireMessageHistory(ctx, chatId);

	//             if (messages.length === 0) {
	//                 await ctx.reply('No messages could be retrieved for this channel.');
	//                 return;
	//             }

	//             let response = `Chat history for this channel (${messages.length} messages):\n\n`;
	//             messages.forEach((msg, index) => {
	//                 const sender = msg.from.username || `${msg.from.first_name} ${msg.from.last_name || ''}`.trim() || 'Unknown';
	//                 response += `${index + 1}. ${sender}: ${msg.text || '[non-text message]'}\n`;
	//             });

	//             // Send the response in chunks if it's too long
	//             if (response.length > 4096) {
	//                 const chunks = response.match(/.{1,4096}/g);
	//                 for (const chunk of chunks) {
	//                     await ctx.reply(chunk);
	//                 }
	//             } else {
	//                 await ctx.reply(response);
	//             }

	//         } catch (error) {
	//             console.error('Error in history command:', error);
	//             await ctx.reply('An error occurred while fetching the chat history. Please try again later.');
	//         }
	//     });
	// }

	async function fetchTelegramHistory(ctx, limit) {
		let messages = [];
		let lastMessageId = 0;

		while (messages.length < limit) {
			const fetchedMessages = await ctx.telegram.getMessages(
				ctx.chat.id,
				{
					limit: Math.min(100, limit - messages.length),
					offset_id: lastMessageId,
				}
			);

			if (fetchedMessages.length === 0) break;

			messages = [
				...messages,
				...fetchedMessages.map((msg) => ({
					id: msg.message_id,
					text: msg.text,
					username:
						msg.from.username ||
						`${msg.from.first_name} ${
							msg.from.last_name || ""
						}`.trim(),
					sent_at: new Date(msg.date * 1000),
				})),
			];

			lastMessageId =
				fetchedMessages[fetchedMessages.length - 1].message_id;
		}

		return messages;
	}

	// async function fetchEntireMessageHistory(ctx, chatId) {
	// 	let messages = [];
	// 	let currentMessageId = 100;
	// 	let undefinedCount = 0;
	// 	const maxUndefinedStreak = 400;
	// 	const batchSize = 100; // Number of messages to save in each batch

	// 	while (currentMessageId > 0 && undefinedCount < maxUndefinedStreak) {
	// 		try {
	// 			// Only forward messages from the specific chatId
	// 			const message = await ctx.telegram.forwardMessage(
	// 				chatId,
	// 				chatId,
	// 				currentMessageId
	// 			);

	// 			if (message.from && message.text) {
	// 				const loggedMessage = {
	// 					id: message.message_id,
	// 					chat_id: chatId,
	// 					user_id: message.from.id,
	// 					username: message.from.username,
	// 					first_name: message.from.first_name,
	// 					last_name: message.from.last_name,
	// 					text: message.text,
	// 					sent_at: new Date(message.date * 1000),
	// 				};
	// 				messages.push(loggedMessage);
	// 				console.log(
	// 					"Fetched message:",
	// 					JSON.stringify(loggedMessage, null, 2)
	// 				);
	// 				undefinedCount = 0; // Reset the undefined count

	// 				if (messages.length >= batchSize) {
	// 					await saveBulkMessages(messages);
	// 					messages = []; // Clear the messages array after saving
	// 				}
	// 			} else {
	// 				undefinedCount++;
	// 				console.log("Skipped message:", message.message_id);
	// 			}

	// 			// Delete the forwarded message
	// 			await ctx.telegram
	// 				.deleteMessage(chatId, message.message_id)
	// 				.catch(() => {});
	// 		} catch (error) {
	// 			console.log(
	// 				`Couldn't forward message ${currentMessageId}:`,
	// 				error.message
	// 			);
	// 			undefinedCount++;
	// 		}

	// 		currentMessageId--;

	// 		await new Promise((resolve) => setTimeout(resolve, 1500));
	// 	}

	// 	// Save any remaining messages
	// 	if (messages.length > 0) {
	// 		await saveBulkMessages(messages);
	// 	}

	// 	return messages.reverse();
	// }
}
