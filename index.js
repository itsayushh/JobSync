import express from 'express';
import cors from 'cors';
import config from './src/config/index.js';
import cron from 'node-cron';
// Routes
import authRoutes from './src/routes/auth.js';
import emailRoutes from './src/routes/email.js';
import notionRoutes from './src/routes/notion.js';
import jobRoutes from './src/routes/job.js';
// Services (optional init check)
import GmailService from './src/services/gmail.js';
import { addBulkEmailsToQueue } from './src/queue/email.js';
import EmailProcessor from './src/workers/emailProcessor.js';

// Initialize Express app
const app = express();
const PORT = config.server.port;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: config.server.nodeEnv,
    version: process.env.npm_package_version || '1.0.0',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/notion', notionRoutes);
app.use('/api/jobs', jobRoutes);

// Root endpoint with API documentation
app.get('/', (req, res) => {
  res.json({
    name: 'Gmail Job Tracker API',
    version: '1.0.0',
    description: 'Automated job application tracking system',
    endpoints: {
      health: 'GET /health',
      auth: {
        login: 'GET /api/auth/login',
        callback: 'GET /api/auth/callback',
        status: 'GET /api/auth/status',
      },
      emails: {
        sync: 'POST /api/emails/sync',
        recent: 'GET /api/emails/recent',
        parse: 'POST /api/emails/parse/:emailId',
        process: 'POST /api/emails/process/:emailId',
        queueStatus: 'GET /api/emails/queue/status',
        failedJobs: 'GET /api/emails/queue/failed',
        retryJobs: 'POST /api/emails/queue/retry',
      },
      notion: {
        applications: 'GET /api/notion/applications',
        createApplication: 'POST /api/notion/applications',
        updateApplication: 'PUT /api/notion/applications/:id',
        deleteApplication: 'DELETE /api/notion/applications/:id',
        stats: 'GET /api/notion/stats',
        sync: 'POST /api/notion/sync',
      },
      jobs: {
        list: 'GET /api/jobs',
        create: 'POST /api/jobs',
        get: 'GET /api/jobs/:id',
        update: 'PUT /api/jobs/:id',
        delete: 'DELETE /api/jobs/:id',
        stats: 'GET /api/jobs/stats/overview',
        import: 'POST /api/jobs/import/email/:emailId',
        bulkImport: 'POST /api/jobs/bulk-import',
        search: 'GET /api/jobs/search',
      },
    },
    documentation: 'Visit /api/docs for detailed API documentation',
  });
});


// Initialize services and start server
async function startServer() {
  try {
    console.log('🚀 Starting Gmail Job Tracker Server...');
    
    // Initialize Gmail service (optional validation)
    try {
      const gmailService = new GmailService();
      console.log('✅ Gmail service initialized');
    } catch (error) {
      console.warn('⚠️  Gmail service initialization warning:', error.message);
    }

    // Start the email processor worker
    console.log('🔧 Starting email processor worker...');
    const emailProcessor = new EmailProcessor();
    console.log('✅ Email processor worker started');

    // Start the server
    app.listen(PORT, () => {
      console.log('🎉 Server started successfully!');
      console.log(`📡 Server running on port ${PORT}`);
      console.log(`🌐 Environment: ${config.server.nodeEnv}`);
      console.log(`📋 Health check: http://localhost:${PORT}/health`);
      console.log(`📚 API docs: http://localhost:${PORT}/`);
      console.log('');
      console.log('Available endpoints:');
      console.log(`  🔐 Auth: http://localhost:${PORT}/api/auth`);
      console.log(`  📧 Emails: http://localhost:${PORT}/api/emails`);
      console.log(`  📝 Notion: http://localhost:${PORT}/api/notion`);
      console.log(`  💼 Jobs: http://localhost:${PORT}/api/jobs`);
    });

    // Setup automated email sync (cron job)
    if (config.cron.schedule) {
      console.log(`⏰ Setting up automated sync: ${config.cron.schedule}`);
      
      cron.schedule(config.cron.schedule, async () => {
        try {
          console.log('🔄 Starting automated email sync...');
          
          const gmailService = new GmailService();
          const emails = await gmailService.getJobEmails(50, 7); // Last 7 days, max 50 emails
          
          if (emails.length > 0) {
            await addBulkEmailsToQueue(emails);
            console.log(`✅ Automated sync: ${emails.length} emails queued for processing`);
          } else {
            console.log('ℹ️  Automated sync: No new job emails found');
          }
        } catch (error) {
          console.error('❌ Automated sync failed:', error.message);
        }
      });
      
      console.log('✅ Automated email sync scheduled');
    }

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📴 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();

export default app;