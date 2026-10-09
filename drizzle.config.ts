import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  // Migraciones versionadas: `npm run db:generate` las escribe acá a partir del
  // schema y `npm run db:migrate` las aplica. Ver docs/MIGRACIONES.md.
  out: "./drizzle",
  dbCredentials: {
    // biome-ignore lint: variable de entorno requerida
    url: process.env.DATABASE_URL as string,
  },
});
