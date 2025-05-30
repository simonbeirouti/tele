-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the users table
CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create the chat_groups table
CREATE TABLE IF NOT EXISTS chat_groups (
    id BIGINT PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create the messages table
CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,
    chat_group_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    text TEXT NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL,
    embedding vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chat_group_id) REFERENCES chat_groups(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_messages_chat_group_id ON messages(chat_group_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);

-- Update the chat_interactions table
CREATE TABLE IF NOT EXISTS chat_interactions (
    id BIGSERIAL PRIMARY KEY,
    initial_message_id BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (initial_message_id) REFERENCES messages(id)
);

-- Create the ai_responses table
CREATE TABLE IF NOT EXISTS ai_responses (
    id BIGSERIAL PRIMARY KEY,
    interaction_id BIGINT NOT NULL,
    response_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (interaction_id) REFERENCES chat_interactions(id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_chat_interactions_initial_message_id ON chat_interactions(initial_message_id);
CREATE INDEX IF NOT EXISTS idx_ai_responses_interaction_id ON ai_responses(interaction_id);
