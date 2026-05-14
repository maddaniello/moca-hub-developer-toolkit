import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://postgres.vhzmstskkeksgruisxkq:T@_ZwJZ7gW3$Y.G@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

async function main() {
  try {
    await client.connect();
    console.log('Connected to Supabase DB via pooler!');
    const res = await client.query('SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = \'public\'');
    console.log('Tables:', res.rows.map(r => r.tablename));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
