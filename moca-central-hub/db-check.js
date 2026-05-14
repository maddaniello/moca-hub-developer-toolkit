import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://postgres.vhzmstskkeksgruisxkq:T@_ZwJZ7gW3$Y.G@db.vhzmstskkeksgruisxkq.supabase.co:5432/postgres'
});

async function main() {
  try {
    await client.connect();
    console.log('Connected to Supabase DB!');
    const res = await client.query('SELECT version FROM supabase_migrations.schema_migrations ORDER BY version ASC');
    console.log('Applied migrations:', res.rows.map(r => r.version));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
