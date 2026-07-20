const { Pool } = require('pg');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '121koko9a';
const DATABASE_URL = process.env.DATABASE_URL;

let pool;

function getPool() {
  if (!pool) {
    if (!DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
  }
  return pool;
}

async function initTables() {
  const db = getPool();
  await db.query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    screenshots JSONB DEFAULT '[]',
    approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS plugins (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    link VARCHAR(500),
    code VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  console.log('Tables ready');
}

function parseBody(req) {
  return new Promise((resolve) => {
    if (req.method !== 'POST') return resolve({});
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => {
      try { resolve(JSON.parse(raw)); }
      catch { resolve({}); }
    });
    setTimeout(() => resolve({}), 3000);
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try { await initTables(); } catch (e) {
    console.error('DB init error:', e.message);
  }

  const db = getPool();
  const url = req.url.split('?')[0];
  const queryParams = Object.fromEntries(new URLSearchParams(req.url.split('?')[1] || ''));
  const body = await parseBody(req);
  const data = { ...queryParams, ...body };

  try {
    // LOGIN
    if (url === '/api/login') {
      const username = data.username || queryParams.username;
      const password = data.password || queryParams.password;

      if (username === 'admin' && password === ADMIN_PASSWORD) {
        return res.json({ success: true, isAdmin: true, token: 'admin_' + Date.now() });
      }

      const result = await db.query(
        'SELECT * FROM users WHERE username = $1 AND password = $2 AND approved = true',
        [username, password]
      );
      if (result.rows.length > 0) {
        return res.json({
          success: true,
          isAdmin: false,
          userId: result.rows[0].id,
          username: result.rows[0].username,
          token: 'user_' + result.rows[0].id
        });
      }
      return res.status(401).json({ error: 'Invalid login or password!' });
    }

    // REGISTER
    if (url === '/api/register' && req.method === 'POST') {
      const { username, password, screenshots } = data;
      if (!username || !password) {
        return res.status(400).json({ error: 'Missing data!' });
      }

      const exists = await db.query('SELECT id FROM users WHERE username = $1', [username]);
      if (exists.rows.length > 0) {
        return res.status(400).json({ error: 'User already exists!' });
      }

      await db.query(
        'INSERT INTO users (username, password, screenshots) VALUES ($1, $2, $3)',
        [username, password, JSON.stringify(screenshots || [])]
      );
      console.log('Registration:', username);
      return res.json({ success: true, message: 'Account created! Wait for approval.' });
    }

    // PENDING
    if (url === '/api/pending' && req.method === 'GET') {
      const result = await db.query(
        "SELECT id, username, screenshots, created_at::text FROM users WHERE approved = false ORDER BY created_at DESC"
      );
      return res.json(result.rows.map(u => ({
        id: u.id,
        username: u.username,
        screenshots: u.screenshots || [],
        createdAt: u.created_at
      })));
    }

    // APPROVE
    if (url === '/api/approve' && req.method === 'POST') {
      if (data.adminPassword !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Invalid password!' });
      }
      await db.query(
        'UPDATE users SET approved = true, approved_at = CURRENT_TIMESTAMP WHERE id = $1',
        [data.userId]
      );
      return res.json({ success: true, message: 'User approved!' });
    }

    // REJECT
    if (url === '/api/reject' && req.method === 'POST') {
      if (data.adminPassword !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Invalid password!' });
      }
      await db.query('DELETE FROM users WHERE id = $1 AND approved = false', [data.userId]);
      return res.json({ success: true, message: 'User rejected!' });
    }

    // GET PLUGINS
    if (url === '/api/plugins' && req.method === 'GET') {
      const result = await db.query('SELECT * FROM plugins ORDER BY name ASC');
      return res.json(result.rows);
    }

    // ADD PLUGIN
    if (url === '/api/plugins/add' && req.method === 'POST') {
      if (data.adminPassword !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Invalid password!' });
      }
      const id = Math.random().toString(36).substring(2, 15);
      const code = data.code || Math.random().toString(36).substring(2, 10).toUpperCase();
      await db.query(
        'INSERT INTO plugins (id, name, description, link, code) VALUES ($1, $2, $3, $4, $5)',
        [id, data.name, data.description || '', data.link || '', code]
      );
      return res.json({ success: true, message: 'Plugin added!', plugin: { id, name: data.name, code } });
    }

    // DELETE PLUGIN
    if (url === '/api/plugins/delete' && req.method === 'POST') {
      if (data.adminPassword !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Invalid password!' });
      }
      await db.query('DELETE FROM plugins WHERE id = $1', [data.pluginId]);
      return res.json({ success: true, message: 'Plugin deleted!' });
    }

    // UPDATE PLUGIN
    if (url === '/api/plugins/update' && req.method === 'POST') {
      if (data.adminPassword !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Invalid password!' });
      }
      await db.query(
        'UPDATE plugins SET name = $1, description = $2, link = $3, code = $4 WHERE id = $5',
        [data.name, data.description, data.link, data.code, data.pluginId]
      );
      return res.json({ success: true, message: 'Plugin updated!' });
    }

    // GET USERS
    if (url === '/api/users' && req.method === 'GET') {
      const result = await db.query(
        "SELECT id, username, approved_at::text FROM users WHERE approved = true ORDER BY approved_at DESC"
      );
      return res.json(result.rows.map(u => ({
        id: u.id,
        username: u.username,
        approvedAt: u.approved_at
      })));
    }

    // DELETE USER
    if (url === '/api/users/delete' && req.method === 'POST') {
      if (data.adminPassword !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Invalid password!' });
      }
      await db.query('DELETE FROM users WHERE id = $1', [data.userId]);
      return res.json({ success: true, message: 'User deleted!' });
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
    console.error('API Error:', e.message);
    return res.status(500).json({ error: 'Server error' });
  }
};
