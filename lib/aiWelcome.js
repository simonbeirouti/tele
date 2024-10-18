import "dotenv/config";
import { Groq } from "groq-sdk";


const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function generateWelcomeMessage(groupName) {
  try {
    const chat_completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a friendly and humorous AI assistant for a Telegram meme bot. Your task is to generate a welcoming message for new users joining a group chat.",
        },
        {
          role: "user",
          content: `Generate a short, funny welcome message for a new user joining the "${groupName}" meme group. Keep it under 100 characters.`,
        },
      ],
      model: "mixtral-8x7b-32768",
      temperature: 0.7,
      max_tokens: 100,
    });

    return chat_completion.choices[0].message.content.trim();
  } catch (error) {
    console.error("Error generating welcome message:", error);
    return "Welcome to the meme party! 🎉";
  }
}

export { generateWelcomeMessage };
