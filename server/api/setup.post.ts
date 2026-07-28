import { query } from '../utils/db'

export default defineEventHandler(async () => {
  // Users table
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#ff6b8a',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Todo categories
  await query(`
    CREATE TABLE IF NOT EXISTS todo_categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      icon TEXT NOT NULL DEFAULT '📋',
      color TEXT NOT NULL DEFAULT '#f0c060',
      sort_order INT NOT NULL DEFAULT 0
    )
  `)

  // Todos
  await query(`
    CREATE TABLE IF NOT EXISTS todos (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      category_id INT REFERENCES todo_categories(id) ON DELETE SET NULL,
      created_by INT REFERENCES users(id),
      assigned_to INT REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'dream')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )
  `)

  // Calendar events
  await query(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      event_type TEXT NOT NULL DEFAULT 'event' CHECK (event_type IN ('event', 'availability', 'reminder', 'date_night')),
      start_time TIMESTAMPTZ NOT NULL,
      end_time TIMESTAMPTZ,
      all_day BOOLEAN DEFAULT false,
      created_by INT REFERENCES users(id),
      alert_before INT DEFAULT 0,
      color TEXT DEFAULT '#a78bfa',
      location TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Seed default data
  const existingUsers = await query('SELECT COUNT(*) as c FROM users')
  if (parseInt(existingUsers.rows[0].c) === 0) {
    await query(`INSERT INTO users (name, color) VALUES ('Aksel', '#ff6b8a'), ('Amandine', '#a78bfa')`)
    
    await query(`INSERT INTO todo_categories (name, icon, color, sort_order) VALUES 
      ('À faire', 'lucide:clipboard-list', '#f0c060', 1),
      ('En cours', 'lucide:zap', '#4adec0', 2),
      ('Acquis / Fait', 'lucide:check-circle', '#6fcf97', 3),
      ('Rêves', 'lucide:sparkles', '#a78bfa', 4)
    `)
  }

  return { success: true, message: 'Database setup complete' }
})
