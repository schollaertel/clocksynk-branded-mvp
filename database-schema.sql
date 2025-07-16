-- ClockSynk Database Schema for Supabase
-- Run this SQL in your Supabase SQL Editor to create the required tables

-- Create the game_states table with proper timestamp support
CREATE TABLE IF NOT EXISTS game_states (
    id BIGSERIAL PRIMARY KEY,
    game_id TEXT UNIQUE NOT NULL,
    home_score INTEGER DEFAULT 0 CHECK (home_score >= 0),
    away_score INTEGER DEFAULT 0 CHECK (away_score >= 0),
    period INTEGER DEFAULT 1 CHECK (period >= 1 AND period <= 10),
    clock_time INTEGER DEFAULT 900 CHECK (clock_time >= 0),
    is_running BOOLEAN DEFAULT FALSE,
    start_time TIMESTAMPTZ NULL,
    last_update_time TIMESTAMPTZ DEFAULT NOW(),
    penalties JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_game_states_game_id ON game_states(game_id);
CREATE INDEX IF NOT EXISTS idx_game_states_updated_at ON game_states(updated_at);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a trigger to automatically update updated_at on row changes
DROP TRIGGER IF EXISTS update_game_states_updated_at ON game_states;
CREATE TRIGGER update_game_states_updated_at
    BEFORE UPDATE ON game_states
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) for better security
ALTER TABLE game_states ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (adjust as needed for your security requirements)
-- Note: For production, you may want to restrict access based on authentication

-- Policy to allow anyone to read game states (for spectator access)
CREATE POLICY "Allow public read access to game_states" ON game_states
    FOR SELECT USING (true);

-- Policy to allow anyone to insert new games (for demo purposes)
CREATE POLICY "Allow public insert access to game_states" ON game_states
    FOR INSERT WITH CHECK (true);

-- Policy to allow anyone to update game states (for scorekeeper access)
CREATE POLICY "Allow public update access to game_states" ON game_states
    FOR UPDATE USING (true);

-- Policy to allow anyone to delete game states (for cleanup)
CREATE POLICY "Allow public delete access to game_states" ON game_states
    FOR DELETE USING (true);

-- Create a view for easier querying (optional)
CREATE OR REPLACE VIEW active_games AS
SELECT 
    game_id,
    home_score,
    away_score,
    period,
    clock_time,
    is_running,
    start_time,
    last_update_time,
    penalties,
    updated_at
FROM game_states
WHERE updated_at > NOW() - INTERVAL '24 hours'
ORDER BY updated_at DESC;

-- Insert a sample game for testing (optional)
INSERT INTO game_states (
    game_id,
    home_score,
    away_score,
    period,
    clock_time,
    is_running,
    penalties
) VALUES (
    'demo-game-1',
    0,
    0,
    1,
    900,
    false,
    '{}'
) ON CONFLICT (game_id) DO NOTHING;

-- Verify the table was created successfully
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'game_states'
ORDER BY ordinal_position;

