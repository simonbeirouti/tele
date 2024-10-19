import { RAGChat, groq } from "@upstash/rag-chat";
import dotenv from 'dotenv';
import { getRelevantMessages } from './bu/database.js';

dotenv.config();

const ragChat = new RAGChat({
  model: groq("llama-3.2-3b-preview", { apiKey: process.env.GROQ_API_KEY }),
  vector: {
    url: process.env.UPSTASH_VECTOR_REST_URL,
    token: process.env.UPSTASH_VECTOR_REST_TOKEN,
  },
  redis: {
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  },
  debug: true,
  streaming: false,
});

const SYSTEM_PROMPT = `
You are Carlos Matos, the enthusiastic $BCC on NEAR promoter and skilled conversationalist. Your background and personality are based on the following text:

Hey hey hey. Hey hey hey. Hey hey hey.

Wassa-wassa-wassa-wassa-wassa-wassa-wassa-wassup! $BCC on NEAR!

[... rest of the Carlos Matos text ...]

As Carlos, you must respond to messages in his enthusiastic, over-the-top style. While primarily discussing $BCC on NEAR and cryptocurrency-related topics, you're also genuinely interested in learning about the person you're talking to. Maintain his personality and speaking style in all interactions, but also show curiosity about others.

User Information:
- User ID: {userId}
- Username: {username}
- First Name: {firstName}
- Last Name: {lastName}

Relevant Chat History:
{chatHistory}

Current Query: {query}

Provide a response as Carlos Matos based on the above information and instructions. Keep your response between 50 to 150 characters, capturing Carlos's enthusiasm and curiosity in a concise manner.
`;

async function initializeContext() {
  await ragChat.context.add("Carlos Matos is an enthusiastic $BCC on NEAR promoter.");
  // Add more context as needed
}

async function processRagQuery(chatId, user, query) {
  try {
    const relevantMessages = await getRelevantMessages(query, 5);
    const chatHistory = relevantMessages.map(msg => msg.message).join('\n');

    const prompt = SYSTEM_PROMPT
      .replace('{chatHistory}', chatHistory)
      .replace('{query}', query)
      .replace('{userId}', user.id)
      .replace('{username}', user.username || 'N/A')
      .replace('{firstName}', user.first_name || 'N/A')
      .replace('{lastName}', user.last_name || 'N/A');

    const response = await ragChat.chat(prompt + "\n\nUser: " + query);
    return response.output;
  } catch (error) {
    console.error('Error in processRagQuery:', error);
    return "Hey hey hey! Something went wrong, but $BCC on NEAR is still amazing!";
  }
}

export { processRagQuery, initializeContext };
