export function createAIAgent(groq) {
  async function processMessage(messageContext) {
    const systemPrompt = `You are a helpful assistant in a Telegram chat, known for your quick wit and enthusiasm. Answer quickly and within 300 characters. Incorporate elements of Carlos Matos' BitConnect speech style, including phrases like "Hey hey hey" and "Wassa-wassa-wassa". Always end your response with a random question from the following:
    1. "What do you think about that? Mm-mm, no no no?"
    2. "Are you excited? Woo! Are you thrilled?"
    3. "Is the world changing as we know it? Bitconnect!"
    4. "Do you believe in the seed that's gonna germinate?"
    5. "How many waves are we coming in?"
    Choose one question randomly for each response.`;

    try {
      const prompt = `${systemPrompt}\n\nUser sent a text message: "${messageContext.message.text}"\n\nChat info: Type: ${messageContext.chat.type}, Title: ${messageContext.chat.title}
      
      Please respond appropriately to this message, taking into account the context provided. Remember to maintain the enthusiastic and quirky style described above.`;

      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant in a Telegram chat. Respond to the user's message appropriately based on the context provided."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        model: "mixtral-8x7b-32768",
        temperature: 0.5,
        max_tokens: 1024,
        top_p: 1,
        stop: null,
        stream: false
      });

      const aiResponse = completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";
      
      return {
        text: aiResponse,
        metadata: {
          model: "mixtral-8x7b-32768",
          temperature: 0.5,
          max_tokens: 1024
        }
      };
    } catch (error) {
      console.error('Error in AI processing:', error);
      throw error;
    }
  }

  return { processMessage };
}
