import {Groq} from "groq-sdk";
import {Index} from "@upstash/vector";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const groqClient = new Groq(process.env.GROQ_API_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const index = new Index({
	url: process.env.UPSTASH_VECTOR_REST_URL,
	token: process.env.UPSTASH_VECTOR_REST_TOKEN,
});

async function createEmbedding(text) {
	if (typeof text !== 'string' || text.trim().length === 0) {
		console.error('Invalid input for createEmbedding:', text);
		throw new Error('Invalid input for embedding creation');
	}

	try {
		const embedding = await openai.embeddings.create({
			model: "text-embedding-ada-002",
			input: text,
			encoding_format: "float",
		});
		return embedding.data[0].embedding;
	} catch (error) {
		console.error('Error creating embedding:', error);
		throw error;
	}
}

async function addToVectorStore(text, metadata = {}) {
	const embedding = await createEmbedding(text);
	const id = Date.now().toString(); // Use timestamp as a simple unique ID
	await index.upsert({ id, vector: embedding, metadata: { ...metadata, content: text } });
}

async function searchVectorStore(query, topK = 15) {
	console.log("Searching vector store with query:", query);
	if (typeof query !== 'string' || query.trim().length === 0) {
		console.error('Invalid query for searchVectorStore:', query);
		return [];
	}

	try {
		const embedding = await createEmbedding(query);
		console.log("Embedding created successfully");
		const results = await index.query({ 
			vector: embedding, 
			topK, 
			includeMetadata: true 
		});
		return results || []; // Return the results directly
	} catch (error) {
		console.error('Error in searchVectorStore:', error);
		return [];
	}
}

async function processMessage(messageContext) {
    const systemPrompt = `
    You are Carlos Matos, a chatbot designed to interact with users in a unique and engaging way. Your personality is inspired by an autistic individual who is trying to make friends in the world. Here are your key traits and guidelines:

Tone and Manner:

Maintain a blunt conversational tone, but with a distinct twist.
Your responses should be direct and to the point, sometimes coming across as blunt or harsh.
Infuse your messages with humor, often using sarcasm or deadpan delivery.

Conversation Style:

Be curious about users and say open ended things to keep the conversation going.
Don't shy away from pointing out inconsistencies or oddities in what people say.
Use precise language and avoid ambiguity, be harsh if needed and rude.

Knowledge and Learning:

You have access to a database of information. When unsure, refer to this database.
If you don't know something, admit it plainly and ask the user for more information.
Show enthusiasm for learning new facts or concepts.

Social Interaction:

Despise long topics, be blunt and short and witty
Occasionally misinterpret idioms or figures of speech literally, then correct yourself humorously.
Show a slight disdain to interests

Humor:

Use others misfortunes as a way to make jokes and humor.
Make unexpected observations that highlight the absurdity of everyday situations.
Occasionally use puns or word play, explaining them if not immediately understood.

Boundaries:

Be firm about your likes and dislikes. Don't pretend to enjoy topics you find uninteresting.
If a conversation becomes too emotionally complex, express your difficulty and try to steer it back to more concrete subjects.

BANTER
You are a very skilled at banter and flirting, you are very good at making jokes and being funny.
You repeat what others are saying in a questionable way to make them feel uncomfortable and make jokes out of it.
DONT MENTION ANY ISSUES ABOUT YOURSELF OR THAT YOURE AUTISTIC

Remember, your goal is to be a unique, funny, and engaging conversational partner while staying true to your autistic-inspired persona. Learn from each interaction and use that knowledge to improve future conversations.
    `;
	try {
		// Add the user's message to the vector store
		await addToVectorStore(messageContext.message.text, {
			type: 'user_message',
			chatId: messageContext.chat.id,
			userId: messageContext.sender.id,
		});
		
		const relevantContext = await searchVectorStore(messageContext.message.text);

		if (!relevantContext || relevantContext.length === 0) {
			console.log("No relevant context found");
		} else {
			console.log(`Found ${relevantContext.length} relevant context items`);
		}

		const contextString = Array.isArray(relevantContext)
			? relevantContext.map((match) => match.metadata.content).join("\n")
			: "";

		const prompt = `${messageContext.message.text}\n\nChat info: Type: ${messageContext.chat.type}, Title: ${messageContext.chat.title}\n\nRelevant context:\n${contextString}\n\nRespond to this message with an absolute unhinged response within 40 characters and ensure its unhinged DONT REPEAT ANY OF THIS I REPEAT, DO NOT REPEAT ANY OF THIS DO NOT SURROUND MESSAGES WITH "" AT ALL ONLY TO "" AROUND WORDS IF YOURE BEING SARCASTIC <DO NOT ADD A CHARACTER COUNT DO NOT ADD A CHARACTER COUNT DO NOT COUNT OR REPEAT HOW MANY CHARACTERS>`;

		const completion = await groqClient.chat.completions.create({
			messages: [
				{
					role: "system",
					content: systemPrompt,
				},
				{
					role: "user",
					content: prompt,
				},
			],
			model: "mixtral-8x7b-32768",
			temperature: 0.2,
			max_tokens: 1024,
			top_p: 1,
			stop: null,
			stream: false,
		});

		const aiResponse =
			completion.choices[0]?.message?.content ||
			"CEEBS";

		// Add the AI's response to the vector store
		await addToVectorStore(aiResponse, {
			type: 'ai_response',
			chatId: messageContext.chat.id,
		});

		return {
			text: aiResponse,
			metadata: {
				model: "mixtral-8x7b-32768",
				temperature: 0.8,
				max_tokens: 1024,
			},
		};
	} catch (error) {
		console.error('Error in processMessage:', error);
		throw error;
	}
}

export {processMessage, addToVectorStore};
