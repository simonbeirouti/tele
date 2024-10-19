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

// Initialize RAGChat with the Groq model
export const ragChat = new RAGChat({
  model: groq("llama-3.1-70b-versatile", { apiKey: process.env.GROQ_AI_KEY }),
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
    
    // Add context to RAGChat
    await ragChat.context.add(`User ${user.username || user.id} joined with ID: ${user.id}`);
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
    
    // Add context to RAGChat
    await ragChat.context.add(`Group "${group.title}" (${group.type}) added with ID: ${group.id}`);
  } catch (error) {
    console.error('Error adding/updating group:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function saveMessage(chatId, userId, message, chatType, chatTitle, username, firstName, lastName) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await addUser({ id: userId, username, firstName, lastName });
    await addGroup({ id: chatId, type: chatType, title: chatTitle });

    const result = await client.query(
      'INSERT INTO messages (chat_group_id, user_id, text, sent_at) VALUES ($1, $2, $3, $4) RETURNING id',
      [chatId, userId, message, new Date()]
    );
    const messageId = result.rows[0].id;

    await client.query('COMMIT');
    console.log(`Message added to database with ID: ${messageId}`);
    
    // Add context to RAGChat
    await ragChat.context.add(`User ${username || userId} sent message in ${chatTitle}: "${message}"`);
    
    return messageId;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving message:', error);
    throw error;
  } finally {
    client.release();
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
    
    // Add context to RAGChat
    await ragChat.context.add(`AI responded to message ${messageId}: "${responseText}"`);
    
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
  saveAIResponse
};
