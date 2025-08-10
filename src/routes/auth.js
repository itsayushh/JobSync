import express from 'express';
import GmailService from '../services/gmail.js';
import NotionService from '../services/notion.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../config/index.js';

const router = express.Router();
const gmailService = new GmailService();

/**
 * GET /auth/gmail
 * Get Gmail OAuth URL for authentication
 */
router.get('/gmail', (req, res) => {
  try {
    const authUrl = gmailService.generateAuthUrl();
    res.json({
      success: true,
      authUrl,
      message: 'Visit this URL to authorize the application',
    });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate authentication URL',
    });
  }
});

/**
 * GET /auth/gmail/callback
 * Handle Gmail OAuth callback
 */
router.get('/gmail/callback', async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Authorization code is required',
      });
    }

    const tokens = await gmailService.getTokensFromCode(code);
    
    res.json({
      success: true,
      message: 'Authorization successful',
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_type: tokens.token_type,
        expiry_date: tokens.expiry_date,
      },
      instructions: [
        '1. Copy the refresh_token from the response',
        '2. Add it to your .env file as GMAIL_REFRESH_TOKEN',
        '3. Restart the application',
        '4. You can now sync your emails automatically',
      ],
    });
  } catch (error) {
    console.error('Error handling OAuth callback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to exchange authorization code for tokens',
    });
  }
});

/**
 * POST /auth/test-gmail
 * Test Gmail connection
 */
router.post('/test-gmail', async (req, res) => {
  try {
    // Try to fetch a few emails to test the connection
    const emails = await gmailService.getJobEmails(5, 1);
    
    res.json({
      success: true,
      message: 'Gmail connection successful',
      emailsFound: emails.length,
      sampleEmails: emails.map(email => ({
        id: email.id,
        subject: email.subject,
        from: email.from,
        date: email.date,
      })),
    });
  } catch (error) {
    console.error('Error testing Gmail connection:', error);
    res.status(500).json({
      success: false,
      error: 'Gmail connection failed',
      details: error.message,
    });
  }
});

/**
 * POST /auth/test-notion
 * Test Notion connection
 */
router.post('/test-notion', async (req, res) => {
  try {
    const notionService = new NotionService();
    
    // Try to get database stats
    const stats = await notionService.getDatabaseStats();
    
    res.json({
      success: true,
      message: 'Notion connection successful',
      databaseStats: stats,
    });
  } catch (error) {
    console.error('Error testing Notion connection:', error);
    res.status(500).json({
      success: false,
      error: 'Notion connection failed',
      details: error.message,
      troubleshooting: [
        '1. Check if NOTION_API_KEY is correct',
        '2. Verify NOTION_DATABASE_ID is valid',
        '3. Ensure the integration has access to the database',
        '4. Make sure the database has the required properties',
      ],
    });
  }
});

/**
 * POST /auth/test-gemini
 * Test Gemini API connection
 */
router.post('/test-gemini', async (req, res) => {
  try {
    const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
    
    const result = await model.generateContent('Hello, this is a test message. Please respond with "API connection successful".');
    const response = await result.response;
    const text = response.text();
    
    res.json({
      success: true,
      message: 'Gemini API connection successful',
      testResponse: text,
    });
  } catch (error) {
    console.error('Error testing Gemini API:', error);
    res.status(500).json({
      success: false,
      error: 'Gemini API connection failed',
      details: error.message,
    });
  }
});

/**
 * GET /auth/status
 * Get authentication status for all services
 */
router.get('/status', async (req, res) => {
  const status = {
    gmail: { connected: false, error: null },
    notion: { connected: false, error: null },
    gemini: { connected: false, error: null },
  };

  // Test Gmail
  try {
    await gmailService.getJobEmails(1, 1);
    status.gmail.connected = true;
  } catch (error) {
    status.gmail.error = error.message;
  }

  // Test Notion
  try {
    const notionService = new NotionService();
    await notionService.getDatabaseStats();
    status.notion.connected = true;
  } catch (error) {
    status.notion.error = error.message;
  }

  // Test Gemini
  try {
    const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
    await model.generateContent('Test');
    status.gemini.connected = true;
  } catch (error) {
    status.gemini.error = error.message;
  }

  const allConnected = status.gmail.connected && status.notion.connected && status.gemini.connected;

  res.json({
    success: allConnected,
    message: allConnected ? 'All services connected' : 'Some services have connection issues',
    status,
  });
});

export default router;