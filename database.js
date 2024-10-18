import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

let db;

async function openDatabase() {
  if (!db) {
    db = await open({
      filename: './meme_broker.db',
      driver: sqlite3.Database
    });
  }
  return db;
}

async function initializeDatabase() {
  const db = await openDatabase();
  
  await db.exec(`
    CREATE TABLE IF NOT EXISTS memes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fileId TEXT NOT NULL,
      addedBy INTEGER NOT NULL,
      addedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT,
      firstName TEXT,
      lastName TEXT
    );

    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      memeId INTEGER NOT NULL,
      userId INTEGER NOT NULL,
      vote INTEGER NOT NULL,
      FOREIGN KEY (memeId) REFERENCES memes (id),
      FOREIGN KEY (userId) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS chat_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chatId TEXT,
      userId TEXT,
      username TEXT,
      message TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      chatType TEXT
    );
  `);
}

async function addMeme(meme) {
  const db = await openDatabase();
  const result = await db.run(
    'INSERT INTO memes (fileId, addedBy) VALUES (?, ?)',
    [meme.fileId, meme.addedBy]
  );
  return result;
}

async function getMemes() {
  const db = await openDatabase();
  const memes = await db.all('SELECT * FROM memes');
  return memes;
}

async function addVote(memeId, userId, vote) {
  const db = await openDatabase();
  const result = await db.run(
    'INSERT OR REPLACE INTO votes (memeId, userId, vote) VALUES (?, ?, ?)',
    [memeId, userId, vote]
  );
  return result;
}

async function getLeaderboard() {
  const db = await openDatabase();
  const leaderboard = await db.all(`
    SELECT memes.id, memes.fileId, SUM(votes.vote) as score
    FROM memes
    LEFT JOIN votes ON memes.id = votes.memeId
    GROUP BY memes.id
    ORDER BY score DESC
    LIMIT 10
  `);
  return leaderboard;
}

async function saveChat(chatId, userId, username, message, chatType) {
  const db = await openDatabase();
  const result = await db.run(
    'INSERT INTO chat_history (chatId, userId, username, message, chatType) VALUES (?, ?, ?, ?, ?)',
    [chatId, userId, username, message, chatType]
  );
  return result;
}

async function addUser(user) {
  const db = await openDatabase();
  const result = await db.run(
    'INSERT OR REPLACE INTO users (id, username, firstName, lastName) VALUES (?, ?, ?, ?)',
    [user.id, user.username, user.firstName, user.lastName]
  );
  return result;
}

async function getUser(userId) {
  const db = await openDatabase();
  const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
  return user;
}

async function addGroup(group) {
  const db = await openDatabase();
  const result = await db.run(
    'INSERT OR REPLACE INTO groups (id, title) VALUES (?, ?)',
    [group.id, group.title]
  );
  return result;
}

async function getGroup(groupId) {
  const db = await openDatabase();
  const group = await db.get('SELECT * FROM groups WHERE id = ?', [groupId]);
  return group;
}

async function getMemeVotes(memeId) {
  const db = await openDatabase();
  const votes = await db.all('SELECT * FROM votes WHERE memeId = ?', [memeId]);
  return votes;
}

async function getUserVotes(userId) {
  const db = await openDatabase();
  const votes = await db.all('SELECT * FROM votes WHERE userId = ?', [userId]);
  return votes;
}

async function getChatHistory(limit = 10) {
  const db = await openDatabase();
  const history = await db.all(`
    SELECT * FROM chat_history
    ORDER BY timestamp DESC
    LIMIT ?
  `, [limit]);
  return history;
}

async function getChatHistoryBatch(chatId, offset = 0, limit = 100) {
  const db = await openDatabase();
  const history = await db.all(`
    SELECT * FROM chat_history
    WHERE chatId = ?
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `, [chatId, limit, offset]);
  return history;
}

export {
  initializeDatabase,
  addMeme,
  getMemes,
  addVote,
  getLeaderboard,
  saveChat,
  addUser,
  getUser,
  addGroup,
  getGroup,
  getMemeVotes,
  getUserVotes,
  getChatHistory,
  getChatHistoryBatch
};
