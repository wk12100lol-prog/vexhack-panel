const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_5pCtygfG0xNI@ep-bold-lake-aq5vn708-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
      ssl: { rejectUnauthorized: false }
    });
  }
  return pool;
}

async function initTables() {
  const db = getPool();
  await db.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username VARCHAR(50) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, screenshots JSONB DEFAULT '[]', approved BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, approved_at TIMESTAMP)`);
  await db.query(`CREATE TABLE IF NOT EXISTS plugins (id VARCHAR(50) PRIMARY KEY, name VARCHAR(100) NOT NULL, description TEXT, link VARCHAR(500), code VARCHAR(20), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  console.log('✅ Tabele gotowe!');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  await initTables();
  const db = getPool();
  const url = req.url.split('?')[0];

  try {
    // REGISTER
    if (url === '/api/register' && req.method === 'POST') {
      const { username, password, screenshots } = req.body;
      if (!username || !password) return res.status(400).json({ error: 'Brak danych!' });

      const exists = await db.query('SELECT id FROM users WHERE username = $1', [username]);
      if (exists.rows.length > 0) return res.status(400).json({ error: 'Użytkownik już istnieje!' });

      await db.query('INSERT INTO users (username, password, screenshots) VALUES ($1, $2, $3)', [username, password, JSON.stringify(screenshots || [])]);
      console.log(`📝 Rejestracja: ${username}`);
      return res.json({ success: true, message: 'Konto utworzone! Czekaj na akceptację.' });
    }

    // LOGIN
    if (url === '/api/login' && req.method === 'POST') {
      const { username, password } = req.body;
      if (username === 'admin' && password === 'vexhack2026') {
        return res.json({ success: true, isAdmin: true, token: 'admin_' + Date.now() });
      }
      const result = await db.query('SELECT * FROM users WHERE username = $1 AND password = $2 AND approved = true', [username, password]);
      if (result.rows.length > 0) {
        return res.json({ success: true, isAdmin: false, userId: result.rows[0].id, token: 'user_' + result.rows[0].id });
      }
      return res.status(401).json({ error: 'Nieprawidłowy login lub hasło!' });
    }

    // PENDING
    if (url === '/api/pending' && req.method === 'GET') {
      const result = await db.query("SELECT id, username, screenshots, created_at::text FROM users WHERE approved = false ORDER BY created_at DESC");
      return res.json(result.rows.map(u => ({ id: u.id, username: u.username, screenshots: u.screenshots || [], createdAt: u.created_at })));
    }

    // APPROVE
    if (url === '/api/approve' && req.method === 'POST') {
      const { userId, adminPassword } = req.body;
      if (adminPassword !== 'vexhack2026') return res.status(401).json({ error: 'Nieprawidłowe hasło!' });
      await db.query('UPDATE users SET approved = true, approved_at = CURRENT_TIMESTAMP WHERE id = $1', [userId]);
      return res.json({ success: true, message: 'Użytkownik zatwierdzony!' });
    }

    // REJECT
    if (url === '/api/reject' && req.method === 'POST') {
      const { userId, adminPassword } = req.body;
      if (adminPassword !== 'vexhack2026') return res.status(401).json({ error: 'Nieprawidłowe hasło!' });
      await db.query('DELETE FROM users WHERE id = $1 AND approved = false', [userId]);
      return res.json({ success: true, message: 'Użytkownik odrzucony!' });
    }

    // GET PLUGINS
    if (url === '/api/plugins' && req.method === 'GET') {
      const result = await db.query('SELECT * FROM plugins ORDER BY name ASC');
      return res.json(result.rows);
    }

    // ADD PLUGIN
    if (url === '/api/plugins/add' && req.method === 'POST') {
      const { name, description, link, code, adminPassword } = req.body;
      if (adminPassword !== 'vexhack2026') return res.status(401).json({ error: 'Nieprawidłowe hasło!' });
      const id = Math.random().toString(36).substring(2, 15);
      const code2 = code || Math.random().toString(36).substring(2, 10).toUpperCase();
      await db.query('INSERT INTO plugins (id, name, description, link, code) VALUES ($1, $2, $3, $4, $5)', [id, name, description || '', link, code2]);
      return res.json({ success: true, message: 'Plugin dodany!', plugin: { id, name, code: code2 } });
    }

    // DELETE PLUGIN
    if (url === '/api/plugins/delete' && req.method === 'POST') {
      const { pluginId, adminPassword } = req.body;
      if (adminPassword !== 'vexhack2026') return res.status(401).json({ error: 'Nieprawidłowe hasło!' });
      await db.query('DELETE FROM plugins WHERE id = $1', [pluginId]);
      return res.json({ success: true, message: 'Plugin usunięty!' });
    }

    // UPDATE PLUGIN
    if (url === '/api/plugins/update' && req.method === 'POST') {
      const { pluginId, name, description, link, code, adminPassword } = req.body;
      if (adminPassword !== 'vexhack2026') return res.status(401).json({ error: 'Nieprawidłowe hasło!' });
      await db.query('UPDATE plugins SET name = $1, description = $2, link = $3, code = $4 WHERE id = $5', [name, description, link, code, pluginId]);
      return res.json({ success: true, message: 'Plugin zaktualizowany!' });
    }

    // GET USERS
    if (url === '/api/users' && req.method === 'GET') {
      const result = await db.query("SELECT id, username, approved_at::text FROM users WHERE approved = true ORDER BY approved_at DESC");
      return res.json(result.rows.map(u => ({ id: u.id, username: u.username, approvedAt: u.approved_at })));
    }

    // DELETE USER
    if (url === '/api/users/delete' && req.method === 'POST') {
      const { userId, adminPassword } = req.body;
      if (adminPassword !== 'vexhack2026') return res.status(401).json({ error: 'Nieprawidłowe hasło!' });
      await db.query('DELETE FROM users WHERE id = $1', [userId]);
      return res.json({ success: true, message: 'Użytkownik usunięty!' });
    }

    // STATS
    if (url === '/api/stats' && req.method === 'GET') {
      const [plugins, users, pending] = await Promise.all([
        db.query('SELECT COUNT(*) FROM plugins'),
        db.query('SELECT COUNT(*) FROM users WHERE approved = true'),
        db.query('SELECT COUNT(*) FROM users WHERE approved = false')
      ]);
      return res.json({
        plugins: parseInt(plugins.rows[0].count),
        users: parseInt(users.rows[0].count),
        pending: parseInt(pending.rows[0].count)
      });
    }

    return res.status(404).json({ message: 'Not found' });

  } catch (e) {
    return res.status(500).json({ error: 'Błąd serwera' });
  }
};