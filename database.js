import pg from 'pg';
import dotenv from 'dotenv';
import { RAGChat, groq } from "@upstash/rag-chat";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});

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

async function initializeDatabase() {
  const client = await pool.connect();
  try {
    // Read and execute the SQL from schema.sql
    const fs = await import('fs');
    const schema = fs.readFileSync('schema.sql', 'utf8');
    await client.query(schema);
    console.log('Database schema initialized');
  } catch (error) {
    console.error('Error initializing database schema:', error);
  } finally {
    client.release();
  }
}

async function addUser(user) {
  const client = await pool.connect();
  try {
    await client.query(
      'INSERT INTO users (id, username, first_name, last_name) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET username = COALESCE($2, users.username), first_name = COALESCE($3, users.first_name), last_name = COALESCE($4, users.last_name)',
      [user.id, user.username, user.firstName, user.lastName]
    );
  } catch (error) {
    console.error('Error adding/updating user:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function addGroup(group) {
  const client = await pool.connect();
  try {
    await client.query(
      'INSERT INTO chat_groups (id, type, title) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET type = COALESCE($2, chat_groups.type), title = COALESCE($3, chat_groups.title)',
      [group.id, group.type, group.title]
    );
  } catch (error) {
    console.error('Error adding/updating group:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function saveMessage(chatId, userId, message, chatType, chatTitle) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // First, ensure the user and chat group exist
    await addUser({ id: userId });
    await addGroup({ id: chatId, type: chatType, title: chatTitle });

    // Save the message to PostgreSQL
    const result = await client.query(
      'INSERT INTO messages (chat_group_id, user_id, text, sent_at) VALUES ($1, $2, $3, $4) RETURNING id',
      [chatId, userId, message, new Date()]
    );
    const messageId = result.rows[0].id;

    // Generate embedding
    // const embedding = await ragChat.embedder.embed(message);

    // // Update the message with the embedding
    // await client.query(
    //   'UPDATE messages SET embedding = $1 WHERE id = $2',
    //   [embedding, messageId]
    // );

    // // If PostgreSQL operations are successful, add to Upstash vector store
    // const upstashResult = await ragChat.index.upsert([
    //   {
    //     id: `${chatId}-${userId}-${messageId}`,
    //     content: message,
    //     metadata: { chatId, userId, messageId }
    //   }
    // ]);

    // if (!upstashResult.success) {
    //   throw new Error('Failed to add message to vector store');
    // }

    await client.query('COMMIT');
    console.log(`Message added to database and vector store with ID: ${messageId}`);
    return messageId; // Return the message ID
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving message:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function getRelevantMessages(query, limit = 5) {
  try {
    const result = await ragChat.index.query({
      topK: limit,
      vector: await ragChat.embedder.embed(query),
      includeVectors: false,
      includeMetadata: true,
    });

    return result.matches.map(match => ({
      message: match.content,
      metadata: match.metadata
    }));
  } catch (error) {
    console.error('Error getting relevant messages:', error);
    return [];
  }
}

async function saveAIResponse(messageId, responseText) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'INSERT INTO ai_responses (message_id, response_text) VALUES ($1, $2) RETURNING id',
      [messageId, responseText]
    );
    const responseId = result.rows[0].id;
    console.log(`AI response saved to database with ID: ${responseId}`);
    return responseId;
  } catch (error) {
    console.error('Error saving AI response:', error);
    throw error;
  } finally {
    client.release();
  }
}

export {
  initializeDatabase,
  addUser,
  addGroup,
  saveMessage,
  getRelevantMessages,
  saveAIResponse
};
