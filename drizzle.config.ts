import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: {
    // biome-ignore lint: variable de entorno requerida
    url: process.env.DATABASE_URL as string,
  },
});
