import { defineConfig } from 'drizzle-kit';

// `npx drizzle-kit generate` writes a new SQL migration after a change to the schema;
// the server applies them on startup
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
});
