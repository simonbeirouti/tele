# Database Setup for Telegram MEME Broker

## 1. Choose a Database

For this bot, we'll use SQLite as our database. It's lightweight, serverless, and works well for small to medium-sized applications.

## 2. Install Dependencies

Add the SQLite driver to your project:

```bash
npm install sqlite3
```

## 3. Set up SQLite Connection

Create a file called `database.js` in your project root:

```javascript:database.js
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function openDatabase() {
  return open({
    filename: './meme_broker.db',
    driver: sqlite3.Database
  });
}

export { openDatabase };
```

## 4. Create Database Schema

We'll need tables for:

- Memes
- Users
- Groups
- Votes

Add this function to `database.js` to initialize the database schema:

```javascript:database.js
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
  `);

  await db.close();
}

export { initializeDatabase };
```

## 5. Create Database Functions

Add these functions to `database.js`:

```javascript:database.js
// ... existing code ...

async function addMeme(meme) {
  const db = await openDatabase();
  const result = await db.run(
    'INSERT INTO memes (fileId, addedBy) VALUES (?, ?)',
    [meme.fileId, meme.addedBy]
  );
  await db.close();
  return result;
}

async function getMemes() {
  const db = await openDatabase();
  const memes = await db.all('SELECT * FROM memes');
  await db.close();
  return memes;
}

async function addVote(memeId, userId, vote) {
  const db = await openDatabase();
  const result = await db.run(
    'INSERT OR REPLACE INTO votes (memeId, userId, vote) VALUES (?, ?, ?)',
    [memeId, userId, vote]
  );
  await db.close();
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
  await db.close();
  return leaderboard;
}

export {
  addMeme,
  getMemes,
  addVote,
  getLeaderboard
};
```

## 6. Initialize Database

In your main bot file, import and initialize the database:

```javascript:bot.js
import { initializeDatabase } from './database.js';

// ... other imports and bot setup ...

async function startBot() {
  await initializeDatabase();
  // Start your bot here
  bot.launch();
}

startBot();
```

This setup will allow you to interact with the SQLite database for storing memes, votes, and retrieving leaderboard information.
