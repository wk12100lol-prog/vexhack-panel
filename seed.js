const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_5pCtygfG0xNI@ep-bold-lake-aq5vn708-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false }
});

const plugins = require('./plugins');

async function seed() {
  console.log('🌱 Seedowanie pluginów do Neon...');
  
  for (const p of plugins) {
    try {
      await pool.query(
        'INSERT INTO plugins (id, name, description, link, code) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
        [p.id || p.plugin_id || Math.random().toString(36).substring(2, 15), p.name, p.description || '', p.link || '', p.code || '']
      );
      console.log(`  ✅ ${p.name}`);
    } catch (e) {
      console.log(`  ❌ ${p.name}: ${e.message}`);
    }
  }
  
  console.log(`\n✅ Wstawiono ${plugins.length} pluginów!`);
  process.exit(0);
}

seed();