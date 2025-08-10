import dotenv from 'dotenv';
dotenv.config();

export default {
  gmail: {
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    redirectUri: process.env.GMAIL_REDIRECT_URI,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN,
  },
  notion: {
    apiKey: process.env.NOTION_API_KEY,
    databaseId: process.env.NOTION_DATABASE_ID,
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },
  server: {
    port: parseInt(process.env.PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  cron: {
    schedule: process.env.CRON_SCHEDULE || '*/30 * * * *',
  },
};