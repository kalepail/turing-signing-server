import { Pool } from 'pg'

export default new Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  user: process.env.PG_USER,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,

  connectionTimeoutMillis: 9000,
  idleTimeoutMillis: 9000,
  max: 6,
})