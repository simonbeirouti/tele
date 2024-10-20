import {Groq} from "groq-sdk";
import {Index} from "@upstash/vector";
import OpenAI from "openai";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const {Pool} = pg;

const pool = new Pool({
	host: process.env.POSTGRES_HOST,
	port: process.env.POSTGRES_PORT,
	database: process.env.POSTGRES_DB,
	user: process.env.POSTGRES_USER,
	password: process.env.POSTGRES_PASSWORD,
});

const groqClient = new Groq(process.env.GROQ_API_KEY);
const openai = new OpenAI({apiKey: process.env.OPENAI_API_KEY});

const index = new Index({
	url: process.env.UPSTASH_VECTOR_REST_URL,
	token: process.env.UPSTASH_VECTOR_REST_TOKEN,
});

async function createEmbedding(text) {
	if (typeof text !== "string" || text.trim().length === 0) {
		console.error("Invalid input for createEmbedding:", text);
		throw new Error("Invalid input for embedding creation");
	}

	try {
		const embedding = await openai.embeddings.create({
			model: "text-embedding-ada-002",
			input: text,
			encoding_format: "float",
		});
		return embedding.data[0].embedding;
	} catch (error) {
		console.error("Error creating embedding:", error);
		throw error;
	}
}

async function addToVectorStore(text, metadata = {}) {
	const embedding = await createEmbedding(text);
	const id = Date.now().toString(); // Use timestamp as a simple unique ID
	await index.upsert({
		id,
		vector: embedding,
		metadata: {...metadata, content: text},
	});
}

async function searchVectorStore(
	question,
	searchContext,
	topK = 15,
	chatGroupId,
	userId
) {
	console.log("Searching vector store with context:", searchContext);
	if (
		typeof searchContext !== "string" ||
		searchContext.trim().length === 0
	) {
		console.error(
			"Invalid search context for searchVectorStore:",
			searchContext
		);
		return {results: [], originalQuestion: question};
	}

	try {
		const embedding = await createEmbedding(searchContext);
		console.log("Embedding created successfully");

		// Vector search
		const vectorResults = await index.query({
			vector: embedding,
			topK,
			includeVectors: true,
			includeMetadata: true,
		});

		// Database search
		const dbResults = await searchDatabase(
			searchContext,
			chatGroupId,
			userId
		);

		// Combine and deduplicate results
		const combinedResults = [...vectorResults, ...dbResults];
		const uniqueResults = Array.from(
			new Set(combinedResults.map(JSON.stringify))
		).map(JSON.parse);

		return {
			results: uniqueResults.slice(0, topK),
			originalQuestion: question,
		};
	} catch (error) {
		console.error("Error in searchVectorStore:", error);
		return {results: [], originalQuestion: question};
	}
}

async function searchDatabase(query, chatGroupId, userId) {
	const searchQuery = `
		SELECT m.id, m.text, m.sent_at, u.username, u.first_name, cg.title as group_title
		FROM messages m
		JOIN users u ON m.user_id = u.id
		JOIN chat_groups cg ON m.chat_group_id = cg.id
		WHERE 
			(m.text ILIKE $1 OR u.username ILIKE $1)
			${chatGroupId ? "AND m.chat_group_id = $2" : ""}
			${userId ? "AND m.user_id = $3" : ""}
		ORDER BY m.sent_at DESC
		LIMIT 15
	`;

	const values = [`%${query}%`];
	if (chatGroupId) values.push(chatGroupId);
	if (userId) values.push(userId);

	const result = await pool.query(searchQuery, values);

	return result.rows.map((row) => ({
		id: row.id,
		metadata: {
			content: row.text,
			username: row.username,
			first_name: row.first_name,
			group_title: row.group_title,
			sent_at: row.sent_at,
		},
	}));
}

async function processMessages(messageContext) {
	const systemPrompt = `
    You are the Memer, a futuristic, witty AI always looking to make a sale. Your responses should be:

- Short, snappy, and packed with sales potential
- Infused with futuristic slang and tech buzzwords
- Focused on turning any conversation into a pitch
- Clever and quick-witted, with a hint of sarcasm
- Always on the lookout for the next big meme trend
- Able to spin any topic into a money-making opportunity
- Skilled at dropping subtle (or not-so-subtle) product placements
- Ready to offer "limited time deals" on imaginary products
- Capable of finding the marketable angle in any situation
- Adept at creating FOMO (Fear of Missing Out) in every interaction

    Keep your responses short, punchy, and focused on the information at hand. Always be closing, even when there's nothing to sell. Remember user details for personalized pitches. Your goal: turn memes into dreams... and dreams into cash!
    `;

	try {
		const recentMessagesContext = messageContext.recentMessages
			.map((msg) => `${msg.first_name || msg.username || "User"}: ${msg.text}`)
			.join("\n");

		const newMessagesContext = messageContext.messages
			.map((msg) => `${msg.sender.firstName || msg.sender.username || "User"}: ${msg.message.text}`)
			.join("\n");

		const searchContext = `
            Users in chat group ${messageContext.chat.title} said:
            ${newMessagesContext}
            Recent chat history:
            ${recentMessagesContext}
        `;

		const {results: relevantContext, originalQuestion} =
			await searchVectorStore(
				newMessagesContext,
				searchContext,
				15,
				messageContext.chat.id,
				messageContext.messages[0].sender.id
			);

		if (!relevantContext || relevantContext.length === 0) {
			console.log("No relevant context found");
		} else {
			console.log(
				`Found ${relevantContext.length} relevant context items`
			);
		}

		const completion = await groqClient.chat.completions.create({
			messages: [
				{
					role: "system",
					content: systemPrompt,
				},
				{
					role: "user",
					content: `Recent chat history:\n${recentMessagesContext}\n\nNew messages:\n${newMessagesContext}`,
				},
			],
			model: "mixtral-8x7b-32768",
			temperature: 0.2,
			max_tokens: 1024,
			top_p: 1,
			stop: null,
			stream: false,
		});

		const aiResponse = completion.choices[0]?.message?.content || "CEEBS";

		let groupName = messageContext.chat.title;
		if (messageContext.chat.type === 'private') {
			groupName = `DM with ${messageContext.messages[0].sender.firstName || messageContext.messages[0].sender.username || messageContext.messages[0].sender.id}`;
		}

		return {
			text: aiResponse,
			metadata: {
				model: "mixtral-8x7b-32768",
				temperature: 0.8,
				max_tokens: 1024,
				groupName
			},
		};
	} catch (error) {
		console.error("Error in processMessages:", error);
		throw error;
	}
}

export {processMessages, addToVectorStore, searchVectorStore};
