import pkg from 'pg';
const { Pool } = pkg;
import { env } from './envConfig.js';

const pool = new Pool({
  host: env.DB_HOST,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  port: env.DB_PORT,
  ssl: env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

export const getPostgresDbClient = async () => {
  const client = await pool.connect()
    .then(() => console.log('Successfully connected to Postgres'))
    .catch((error) => console.error('Error connecting to Postgres', error.message));
  return client;
};

export const executeQuery = async (query, params = []) => {
  const client = await getPostgresDbClient();
  try {
    const result = await client.query(query, params);
    return result.rows;
  } catch (error) {
    throw new Error('Error executing query', error.message);
  } finally {
    client.release();
  }
};
