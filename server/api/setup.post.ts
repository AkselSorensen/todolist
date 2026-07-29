import { query } from '../utils/db'

export default defineEventHandler(async () => {
  // Partnerships table
  await query(`
    CREATE TABLE IF NOT EXISTS partnerships (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Accounts (auth)
  await query(`
    CREATE TABLE IF NOT EXISTS accounts (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#ff6b8a',
      partner_id INT REFERENCES accounts(id),
      partnership_id INT REFERENCES partnerships(id),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Refresh tokens
  await query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id SERIAL PRIMARY KEY,
      account_id INT REFERENCES accounts(id) NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL
    )
  `)

  // Users table (legacy, kept for backward compat during migration)
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
      event_type TEXT NOT NULL DEFAULT 'event' CHECK (event_type IN ('event', 'availability', 'reminder', 'date_night', 'trip')),
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

  // Fix event_type constraint for existing DBs (add 'trip')
  await query(`ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS calendar_events_event_type_check`)
  await query(`ALTER TABLE calendar_events ADD CONSTRAINT calendar_events_event_type_check CHECK (event_type IN ('event', 'availability', 'reminder', 'date_night', 'trip'))`)

  // Add partnership_id to existing tables (migration)
  await query(`ALTER TABLE visited_countries ADD COLUMN IF NOT EXISTS partnership_id INT REFERENCES partnerships(id)`)
  await query(`ALTER TABLE todos ADD COLUMN IF NOT EXISTS partnership_id INT REFERENCES partnerships(id)`)
  await query(`ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS partnership_id INT REFERENCES partnerships(id)`)
  await query(`ALTER TABLE todo_categories ADD COLUMN IF NOT EXISTS partnership_id INT REFERENCES partnerships(id)`)

  // Fix FKs: drop old references to users, recreate pointing to accounts
  await query(`ALTER TABLE todos DROP CONSTRAINT IF EXISTS todos_created_by_fkey`)
  await query(`ALTER TABLE todos DROP CONSTRAINT IF EXISTS todos_assigned_to_fkey`)
  await query(`ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS calendar_events_created_by_fkey`)
  // Add new FKs (ignore if already exist)
  await query(`DO $$ BEGIN ALTER TABLE todos ADD CONSTRAINT todos_created_by_fkey FOREIGN KEY (created_by) REFERENCES accounts(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$`)
  await query(`DO $$ BEGIN ALTER TABLE todos ADD CONSTRAINT todos_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES accounts(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$`)
  await query(`DO $$ BEGIN ALTER TABLE calendar_events ADD CONSTRAINT calendar_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES accounts(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$`)

  // Visited countries table
  await query(`
    CREATE TABLE IF NOT EXISTS visited_countries (
      id SERIAL PRIMARY KEY,
      country_name TEXT NOT NULL UNIQUE,
      visited_by TEXT NOT NULL DEFAULT 'both',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  // Add visited_by column if missing (migration)
  await query(`ALTER TABLE visited_countries ADD COLUMN IF NOT EXISTS visited_by TEXT NOT NULL DEFAULT 'both'`)

  // Countries table
  await query(`
    CREATE TABLE IF NOT EXISTS countries (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      en_name TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      continent TEXT NOT NULL DEFAULT 'Europe',
      emoji TEXT NOT NULL DEFAULT '🌍',
      attractions TEXT DEFAULT ''
    )
  `)
  // Add attractions column if missing (migration)
  await query(`ALTER TABLE countries ADD COLUMN IF NOT EXISTS attractions TEXT DEFAULT ''`)

  // Seed countries if empty
  const existingCountries = await query('SELECT COUNT(*) as c FROM countries')
  if (parseInt(existingCountries.rows[0].c) === 0) {
    const seedCountries = [
      ['France','France',46.6,2.3,'Europe','🇫🇷'],['Italie','Italy',41.9,12.5,'Europe','🇮🇹'],['Espagne','Spain',40.4,-3.7,'Europe','🇪🇸'],
      ['Portugal','Portugal',39.4,-8.2,'Europe','🇵🇹'],['Royaume-Uni','United Kingdom',55.4,-3.4,'Europe','🇬🇧'],['Allemagne','Germany',51.2,10.5,'Europe','🇩🇪'],
      ['Suisse','Switzerland',46.8,8.2,'Europe','🇨🇭'],['Autriche','Austria',47.5,14.6,'Europe','🇦🇹'],['Grèce','Greece',39.1,21.8,'Europe','🇬🇷'],
      ['Pays-Bas','Netherlands',52.1,5.3,'Europe','🇳🇱'],['Belgique','Belgium',50.5,4.5,'Europe','🇧🇪'],['Suède','Sweden',60.1,18.6,'Europe','🇸🇪'],
      ['Norvège','Norway',60.5,8.5,'Europe','🇳🇴'],['Danemark','Denmark',56.3,9.5,'Europe','🇩🇰'],['Finlande','Finland',61.9,25.7,'Europe','🇫🇮'],
      ['Islande','Iceland',65.0,-19.0,'Europe','🇮🇸'],['Irlande','Ireland',53.4,-8.2,'Europe','🇮🇪'],['Pologne','Poland',51.9,19.1,'Europe','🇵🇱'],
      ['Rép. Tchèque','Czechia',49.8,15.5,'Europe','🇨🇿'],['Hongrie','Hungary',47.2,19.5,'Europe','🇭🇺'],['Roumanie','Romania',45.9,25.0,'Europe','🇷🇴'],
      ['Croatie','Croatia',45.1,15.2,'Europe','🇭🇷'],['Ukraine','Ukraine',48.4,31.2,'Europe','🇺🇦'],['Turquie','Turkey',39.0,35.2,'Asie','🇹🇷'],
      ['Russie','Russia',61.5,105.3,'Europe','🇷🇺'],['Japon','Japan',36.2,138.3,'Asie','🇯🇵'],['Chine','China',35.9,104.2,'Asie','🇨🇳'],
      ['Inde','India',20.6,79.0,'Asie','🇮🇳'],['Thaïlande','Thailand',15.9,101.0,'Asie','🇹🇭'],['Vietnam','Vietnam',14.1,108.3,'Asie','🇻🇳'],
      ['Indonésie','Indonesia',-0.8,113.9,'Asie','🇮🇩'],['Corée du Sud','South Korea',35.9,127.8,'Asie','🇰🇷'],['Singapour','Singapore',1.4,103.8,'Asie','🇸🇬'],
      ['Maldives','Maldives',3.2,73.2,'Asie','🇲🇻'],['Émirats A. U.','United Arab Emirates',23.4,53.8,'Asie','🇦🇪'],['Israël','Israel',31.0,34.9,'Asie','🇮🇱'],
      ['Jordanie','Jordan',30.6,36.2,'Asie','🇯🇴'],['Cambodge','Cambodia',12.6,105.0,'Asie','🇰🇭'],['Philippines','Philippines',12.9,121.8,'Asie','🇵🇭'],
      ['Népal','Nepal',28.4,84.1,'Asie','🇳🇵'],['Sri Lanka','Sri Lanka',7.9,80.8,'Asie','🇱🇰'],['États-Unis','United States of America',37.1,-95.7,'Amérique','🇺🇸'],
      ['Canada','Canada',56.1,-106.3,'Amérique','🇨🇦'],['Mexique','Mexico',23.6,-102.6,'Amérique','🇲🇽'],['Brésil','Brazil',-14.2,-51.9,'Amérique','🇧🇷'],
      ['Argentine','Argentina',-38.4,-63.6,'Amérique','🇦🇷'],['Colombie','Colombia',4.6,-74.3,'Amérique','🇨🇴'],['Pérou','Peru',-9.2,-75.0,'Amérique','🇵🇪'],
      ['Cuba','Cuba',21.5,-77.8,'Amérique','🇨🇺'],['Costa Rica','Costa Rica',9.7,-83.8,'Amérique','🇨🇷'],['Rép. Dominicaine','Dominican Republic',18.7,-70.2,'Amérique','🇩🇴'],
      ['Chili','Chile',-35.7,-71.5,'Amérique','🇨🇱'],['Maroc','Morocco',31.8,-7.1,'Afrique','🇲🇦'],['Égypte','Egypt',26.8,30.8,'Afrique','🇪🇬'],
      ['Afrique du Sud','South Africa',-30.6,22.9,'Afrique','🇿🇦'],['Kenya','Kenya',-0.02,37.9,'Afrique','🇰🇪'],['Tanzanie','United Republic of Tanzania',-6.4,34.9,'Afrique','🇹🇿'],
      ['Sénégal','Senegal',14.5,-14.5,'Afrique','🇸🇳'],['Tunisie','Tunisia',33.9,9.5,'Afrique','🇹🇳'],['Madagascar','Madagascar',-18.8,46.9,'Afrique','🇲🇬'],
      ['Maurice','Mauritius',-20.3,57.6,'Afrique','🇲🇺'],['Seychelles','Seychelles',-4.7,55.5,'Afrique','🇸🇨'],['Nigeria','Nigeria',9.1,8.7,'Afrique','🇳🇬'],
      ['Ghana','Ghana',7.9,-1.0,'Afrique','🇬🇭'],['Australie','Australia',-25.3,133.8,'Océanie','🇦🇺'],['Nouvelle-Zélande','New Zealand',-40.9,174.9,'Océanie','🇳🇿'],
      ['Fidji','Fiji',-17.7,178.1,'Océanie','🇫🇯'],
    ]
    for (const c of seedCountries) {
      await query('INSERT INTO countries (name, en_name, lat, lng, continent, emoji, attractions) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (name) DO NOTHING', c)
    }
  }

  // Update attractions for existing countries
  const attrs: Record<string, string> = {
    'France': 'Tour Eiffel, Mont Saint-Michel, Châteaux de la Loire, Côte d\'Azur, Versailles, Louvre',
    'Italie': 'Colisée Rome, Venise, Cinque Terre, Toscane, Côte Amalfitaine, Vatican, Pompéi',
    'Espagne': 'Sagrada Familia, Alhambra Grenade, Ibiza, Séville, Costa Brava, Musée Prado',
    'Portugal': 'Tour de Belém, Sintra, Porto, Algarve, Vallée du Douro, Açores',
    'Royaume-Uni': 'Big Ben, Tower Bridge, Stonehenge, Highlands, Oxford, Château d\'Édimbourg',
    'Allemagne': 'Château Neuschwanstein, Porte de Brandebourg, Oktoberfest, Forêt-Noire, Mur de Berlin',
    'Suisse': 'Jungfraujoch, Lac Léman, Zermatt & Matterhorn, Interlaken, Lucerne, Château de Chillon',
    'Autriche': 'Schönbrunn, Hallstatt, Vienne, Salzbourg, Alpes tyroliennes, Innsbruck',
    'Grèce': 'Acropole Athènes, Santorin, Mykonos, Crète, Rhodes, Météores, Corfou',
    'Pays-Bas': 'Canaux Amsterdam, Keukenhof, Moulins Kinderdijk, Rotterdam, Utrecht, Musée Van Gogh',
    'Belgique': 'Grand-Place Bruxelles, Bruges, Atomium, Gand, Anvers, Ardennes',
    'Japon': 'Mont Fuji, Tokyo, Kyoto, Osaka, Hiroshima, Nara, Shibuya, Temples',
    'États-Unis': 'Grand Canyon, New York, Yellowstone, San Francisco, Las Vegas, Miami, Hawaii',
    'Canada': 'Niagara, Banff, Vancouver, Toronto, Montréal, Québec, Rocheuses',
    'Mexique': 'Chichén Itzá, Cancún, Mexico, Tulum, Teotihuacán, Cenotes',
    'Australie': 'Sydney Opera House, Grande Barrière de Corail, Uluru, Melbourne, Gold Coast',
    'Maroc': 'Marrakech, Fès, Chefchaouen, Sahara, Casablanca, Essaouira',
    'Égypte': 'Pyramides de Gizeh, Louxor, Croisière Nil, Alexandrie, Abou Simbel, Mer Rouge',
  }
  for (const [name, attr] of Object.entries(attrs)) {
    await query('UPDATE countries SET attractions = $1 WHERE name = $2 AND (attractions IS NULL OR attractions = \'\')', [attr, name])
  }

  // Date spots (restos, bars, lieux à tester)
  await query(`
    CREATE TABLE IF NOT EXISTS date_spots (
      id SERIAL PRIMARY KEY,
      partnership_id INT REFERENCES partnerships(id),
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'restaurant',
      rating INT CHECK (rating >= 1 AND rating <= 5),
      notes TEXT DEFAULT '',
      visited BOOLEAN DEFAULT false,
      lat REAL,
      lng REAL,
      created_by INT REFERENCES accounts(id),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Memory timeline
  await query(`
    CREATE TABLE IF NOT EXISTS memories (
      id SERIAL PRIMARY KEY,
      partnership_id INT REFERENCES partnerships(id),
      title TEXT NOT NULL,
      date DATE NOT NULL,
      description TEXT DEFAULT '',
      created_by INT REFERENCES accounts(id),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Love notes (petits messages)
  await query(`
    CREATE TABLE IF NOT EXISTS love_notes (
      id SERIAL PRIMARY KEY,
      partnership_id INT REFERENCES partnerships(id),
      from_id INT REFERENCES accounts(id),
      to_id INT REFERENCES accounts(id),
      message TEXT NOT NULL,
      read BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Gift ideas
  await query(`
    CREATE TABLE IF NOT EXISTS gift_ideas (
      id SERIAL PRIMARY KEY,
      partnership_id INT REFERENCES partnerships(id),
      created_by INT REFERENCES accounts(id),
      title TEXT NOT NULL,
      link TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      surprise BOOLEAN DEFAULT false,
      revealed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Daily moods
  await query(`
    CREATE TABLE IF NOT EXISTS daily_moods (
      id SERIAL PRIMARY KEY,
      partnership_id INT REFERENCES partnerships(id),
      account_id INT REFERENCES accounts(id),
      mood TEXT NOT NULL DEFAULT '😊',
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(account_id, date)
    )
  `)

  // Notifications
  await query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      partnership_id INT REFERENCES partnerships(id),
      from_id INT REFERENCES accounts(id),
      to_id INT REFERENCES accounts(id),
      type TEXT NOT NULL DEFAULT 'info',
      message TEXT NOT NULL,
      read BOOLEAN DEFAULT false,
      link TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Trip proposals
  await query(`
    CREATE TABLE IF NOT EXISTS trip_proposals (
      id SERIAL PRIMARY KEY,
      partnership_id INT REFERENCES partnerships(id),
      from_id INT REFERENCES accounts(id),
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      destination TEXT DEFAULT '',
      start_date DATE,
      end_date DATE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  const existingCategories = await query('SELECT COUNT(*) as c FROM todo_categories')
  if (parseInt(existingCategories.rows[0].c) === 0) {
    await query(`INSERT INTO todo_categories (name, icon, color, sort_order) VALUES 
      ('À faire', 'lucide:clipboard-list', '#f0c060', 1),
      ('En cours', 'lucide:zap', '#4adec0', 2),
      ('Acquis / Fait', 'lucide:check-circle', '#6fcf97', 3),
      ('Rêves', 'lucide:sparkles', '#a78bfa', 4)
    `)
  }

  return { success: true, message: 'Database setup complete' }
})
