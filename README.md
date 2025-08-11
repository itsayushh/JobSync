# 📌 Gmail Job Tracker

Automated job application tracking system that syncs Gmail emails with Notion database using AI-powered email parsing.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
Create a `.env` file in the root directory and configure your credentials:

```env
# Gmail API Configuration
GMAIL_CLIENT_ID=your_gmail_client_id
GMAIL_CLIENT_SECRET=your_gmail_client_secret
GMAIL_REFRESH_TOKEN=your_gmail_refresh_token

# Notion API Configuration
NOTION_API_KEY=your_notion_api_key
NOTION_DATABASE_ID=your_notion_database_id

# Gemini AI Configuration
GEMINI_API_KEY=your_gemini_api_key

# Server Configuration
PORT=3000
NODE_ENV=development

# Redis Configuration (optional - uses in-memory if not provided)
REDIS_HOST=localhost
REDIS_PORT=6379

# Cron Schedule (every 30 minutes by default)
CRON_SCHEDULE=*/30 * * * *
```

### 3. Start the Application

**Development mode (with auto-restart):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

**Worker process only:**
```bash
npm run worker
```

### 4. Access the API
- **Health Check**: http://localhost:3000/health
- **API Documentation**: http://localhost:3000/
- **Base URL**: http://localhost:3000/api

## 📡 API Endpoints

### Authentication Routes (`/api/auth`)
- `GET /gmail` - Get Gmail OAuth URL for authentication
- `GET /gmail/callback` - Handle Gmail OAuth callback
- `GET /status` - Check authentication status for all services
- `POST /test-gmail` - Test Gmail API connection
- `POST /test-notion` - Test Notion API connection  
- `POST /test-gemini` - Test Gemini AI API connection

### Email Management (`/api/emails`)
- `POST /sync` - Manually trigger email sync (with daysBack & maxResults params)
- `GET /recent` - Get recent job-related emails without processing
- `POST /parse/:emailId` - Parse specific email using AI
- `POST /process/:emailId` - Process and add email to Notion
- `GET /queue/status` - Get email processing queue status
- `GET /queue/failed` - Get failed email processing jobs
- `POST /queue/retry` - Retry failed email processing jobs
- `DELETE /queue/clean` - Clean completed jobs from queue
- `POST /queue/clear` - Clear all jobs from queue

### Job Applications (`/api/jobs`)
- `GET /` - List all job applications (with filtering & pagination)
- `GET /:id` - Get specific job application details
- `POST /` - Create new job application manually
- `PUT /:id` - Update existing job application
- `DELETE /:id` - Delete/archive job application
- `GET /stats/overview` - Get job application analytics
- `POST /import/email/:emailId` - Import job from specific email
- `POST /bulk-import` - Bulk import jobs from recent emails
- `GET /search` - Search job applications

### Notion Integration (`/api/notion`)
- `GET /applications` - Get all applications from Notion database
- `GET /applications/:id` - Get specific application by ID
- `POST /applications` - Create new application in Notion
- `PUT /applications/:id` - Update application in Notion
- `DELETE /applications/:id` - Delete application from Notion
- `GET /stats` - Get Notion database statistics
- `POST /sync` - Manual sync with Notion
- `GET /database/properties` - Get Notion database schema

## 🛠 Configuration

### Required Environment Variables
```env
# Gmail API - Get from Google Cloud Console
GMAIL_CLIENT_ID=your_gmail_client_id
GMAIL_CLIENT_SECRET=your_gmail_client_secret
GMAIL_REFRESH_TOKEN=your_gmail_refresh_token

# Notion API - Get from Notion Developers
NOTION_API_KEY=your_notion_api_key
NOTION_DATABASE_ID=your_notion_database_id

# Gemini AI - Get from Google AI Studio
GEMINI_API_KEY=your_gemini_api_key
```

### Optional Configuration
```env
# Server Settings
PORT=3000
NODE_ENV=development

# Email Sync Settings
CRON_SCHEDULE=*/30 * * * *  # Every 30 minutes
MAX_EMAILS_PER_SYNC=15
DAYS_BACK_DEFAULT=1

# Redis Configuration (uses in-memory if not provided)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
```

## 🔄 Automated Features

The application automatically:
- **Email Sync**: Fetches job-related emails every 30 minutes (configurable)
- **AI Processing**: Uses Gemini AI to extract job application details
- **Notion Updates**: Creates/updates job applications in Notion database
- **Queue Management**: Handles failed jobs with retry logic
- **Duplicate Detection**: Prevents duplicate entries based on email ID

## 📊 Monitoring & Health Checks

### System Health
- **Health Check**: `GET /health` - Application status and version
- **Auth Status**: `GET /api/auth/status` - Check all service connections

### Queue Monitoring  
- **Queue Status**: `GET /api/emails/queue/status` - Active, waiting, failed jobs
- **Failed Jobs**: `GET /api/emails/queue/failed` - List failed processing jobs
- **Retry Jobs**: `POST /api/emails/queue/retry` - Retry failed jobs

### Analytics
- **Job Stats**: `GET /api/jobs/stats/overview` - Application status breakdown
- **Notion Stats**: `GET /api/notion/stats` - Database statistics

## 🔧 Usage Examples

### Manual Email Sync
```bash
curl -X POST http://localhost:3000/api/emails/sync \
  -H "Content-Type: application/json" \
  -d '{"daysBack": 7, "maxResults": 50}'
```

### Get Recent Applications
```bash
curl http://localhost:3000/api/jobs?status=Applied&limit=10
```

### Test Service Connections
```bash
# Test Gmail
curl -X POST http://localhost:3000/api/auth/test-gmail

# Test Notion  
curl -X POST http://localhost:3000/api/auth/test-notion

# Test Gemini AI
curl -X POST http://localhost:3000/api/auth/test-gemini
```

## 🚀 Getting Started

1. **Setup Gmail API**: Create credentials in Google Cloud Console
2. **Setup Notion**: Create integration and get database ID
3. **Setup Gemini AI**: Get API key from Google AI Studio
4. **Configure Environment**: Add all credentials to `.env`
5. **Initialize Auth**: Visit `/api/auth/gmail` to authorize Gmail access
6. **Test Services**: Use test endpoints to verify connections
7. **Start Syncing**: The system will automatically sync emails every 30 minutes

## 🐛 Troubleshooting

### Common Issues
- **Gmail Auth**: Ensure redirect URI is properly configured
- **Notion Database**: Verify database permissions and structure
- **Queue Issues**: Check Redis connection or use in-memory mode
- **AI Processing**: Verify Gemini API key and quota limits

### Debug Endpoints
- Check service status: `GET /api/auth/status`
- View queue status: `GET /api/emails/queue/status`
- Test individual services: `POST /api/auth/test-*`

## 🧪 Testing API

Use the built-in endpoints to test functionality:

1. **Check Health**: `GET /health`
2. **Sync Emails**: `POST /api/emails/sync`
3. **View Applications**: `GET /api/jobs`
4. **Check Queue**: `GET /api/emails/queue/status`

## 🔧 Development

```bash
# Start with auto-restart
npm run dev

# Check logs
tail -f logs/app.log

# Manual email sync
curl -X POST http://localhost:3000/api/emails/sync

# View recent applications
curl http://localhost:3000/api/jobs
```

## 📝 Notes

- Ensure Redis is running for queue processing
- Configure Gmail API OAuth before first use
- Set up Notion database with proper schema
- Gemini API is used for advanced email parsing

For detailed setup instructions, see the project documentation.
