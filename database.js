import pg from 'pg';
import dotenv from 'dotenv';
import { addToVectorStore } from './aiService.js';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
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
    
    await addToVectorStore(`User ${user.username || user.id} joined with ID: ${user.id}`, { type: 'user_join', userId: user.id });
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
    
    await addToVectorStore(`Group ${group.title || group.id} added with ID: ${group.id}`, { type: 'group_add', groupId: group.id });
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
    
    await addToVectorStore(`Message sent in ${chatTitle || chatId} by ${username || userId}: ${message}`, { type: 'message', messageId, chatId, userId });
    
    return messageId;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving message:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function saveAIResponse(messageId, aiResponse, chatType, chatTitle, username, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Determine group name
    let groupName = chatTitle;
    if (chatType === 'private') {
      groupName = `DM with ${username || userId}`;
    }

    // Create a new chat interaction
    const createInteractionQuery = `
      INSERT INTO chat_interactions (initial_message_id)
      VALUES ($1)
      RETURNING id
    `;
    const interactionResult = await client.query(createInteractionQuery, [messageId]);
    const interactionId = interactionResult.rows[0].id;

    // Insert the AI response
    const insertResponseQuery = `
      INSERT INTO ai_responses (interaction_id, response_text)
      VALUES ($1, $2)
      RETURNING id
    `;
    const responseResult = await client.query(insertResponseQuery, [interactionId, aiResponse]);
    const responseId = responseResult.rows[0].id;

    await client.query('COMMIT');

    return {
      interaction_id: interactionId,
      response_id: responseId,
      group_name: groupName // Return the group name
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving AI response:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function getRecentMessages(chatId, limit) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT m.id, m.text, m.sent_at, u.username, u.first_name, u.last_name
       FROM messages m
       JOIN users u ON m.user_id = u.id
       WHERE m.chat_group_id = $1
       ORDER BY m.sent_at DESC
       LIMIT $2`,
      [chatId, limit]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching recent messages:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function saveBulkMessages(messages) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const message of messages) {
      // First, add or update the user
      await client.query(
        'INSERT INTO users (id, username, first_name, last_name) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET username = COALESCE(EXCLUDED.username, users.username), first_name = COALESCE(EXCLUDED.first_name, users.first_name), last_name = COALESCE(EXCLUDED.last_name, users.last_name)',
        [message.user_id, message.username, message.first_name, message.last_name]
      );

      // Then, insert the message
      const result = await client.query(
        'INSERT INTO messages (id, chat_group_id, user_id, text, sent_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING RETURNING id',
        [message.id, message.chat_id, message.user_id, message.text, message.sent_at]
      );

      // If the message was inserted (not ignored due to conflict), add it to the vector store
      if (result.rows.length > 0) {
        const messageId = result.rows[0].id;
        await addToVectorStore(
          `Message sent in ${message.chat_id} by ${message.username || message.user_id}: ${message.text}`,
          { type: 'message', messageId, chatId: message.chat_id, userId: message.user_id }
        );
      }
    }

    await client.query('COMMIT');
    console.log(`Bulk messages saved to database: ${messages.length}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving bulk messages:', error);
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
  saveAIResponse,
  getRecentMessages,
  saveBulkMessages
};
