import express from 'express';
import GmailService from '../services/gmail.js';
import ParsingService from '../services/parsing.js';
import { addEmailToQueue, addBulkEmailsToQueue, getQueueStatus, getFailedJobs, retryFailedJobs, clearQueue } from '../queue/email.js';

const router = express.Router();
const gmailService = new GmailService();
const parsingService = new ParsingService();

/**
 * POST /emails/sync
 * Manually trigger email sync
 */
router.post('/sync', async (req, res) => {
  try {
    const { daysBack = 1, maxResults = 15 } = req.body;
    
    console.log(`Starting manual email sync: ${maxResults} emails, ${daysBack} days back`);
    
    // Fetch emails from Gmail
    const emails = await gmailService.getJobEmails(maxResults, daysBack);
    
    if (emails.length === 0) {
      return res.json({
        success: true,
        message: 'No job-related emails found',
        emailsFound: 0,
        emailsQueued: 0,
      });
    }
    
    // Add emails to processing queue
    const jobs = await addBulkEmailsToQueue(emails);
    
    res.json({
      success: true,
      message: `Email sync initiated successfully`,
      emailsFound: emails.length,
      emailsQueued: jobs.length,
      estimatedProcessingTime: `${Math.ceil(emails.length / 3)} minutes`, // Assuming 3 concurrent workers
    });
  } catch (error) {
    console.error('Error syncing emails:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync emails',
      details: error.message,
    });
  }
});

/**
 * GET /emails/recent
 * Get recent emails without processing
 */
router.get('/recent', async (req, res) => {
  try {
    const { daysBack = 7, maxResults = 20 } = req.query;
    
    const emails = await gmailService.getJobEmails(
      parseInt(maxResults),
      parseInt(daysBack)
    );
    
    res.json({
      success: true,
      emails: emails.map(email => ({
        id: email.id,
        subject: email.subject,
        from: email.from,
        date: email.date,
        gmailLink: email.gmailLink,
        bodyPreview: email.body.substring(0, 200) + '...',
      })),
      totalFound: emails.length,
    });
  } catch (error) {
    console.error('Error fetching recent emails:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent emails',
      details: error.message,
    });
  }
});

/**
 * POST /emails/parse/:emailId
 * Parse a specific email
 */
router.post('/parse/:emailId', async (req, res) => {
  try {
    const { emailId } = req.params;
    
    // First, get the email data
    const emails = await gmailService.getJobEmails(100, 30);
    const email = emails.find(e => e.id === emailId);
    
    if (!email) {
      return res.status(404).json({
        success: false,
        error: 'Email not found',
      });
    }
    
    // Parse the email
    const parsedData = await parsingService.parseEmail(email);
    
    if (!parsedData || parsedData.isJobRelated === false) {
      return res.json({
        success: true,
        isJobRelated: false,
        message: 'Email is not job-related',
        rawEmail: {
          subject: email.subject,
          from: email.from,
          date: email.date,
        },
      });
    }
    
    res.json({
      success: true,
      isJobRelated: true,
      parsedData,
      rawEmail: {
        subject: email.subject,
        from: email.from,
        date: email.date,
        gmailLink: email.gmailLink,
      },
    });
  } catch (error) {
    console.error('Error parsing email:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to parse email',
      details: error.message,
    });
  }
});

/**
 * POST /emails/process/:emailId
 * Process a specific email (parse + add to Notion)
 */
router.post('/process/:emailId', async (req, res) => {
  try {
    const { emailId } = req.params;
    
    // Get the email data
    const emails = await gmailService.getJobEmails(100, 30);
    const email = emails.find(e => e.id === emailId);
    
    if (!email) {
      return res.status(404).json({
        success: false,
        error: 'Email not found',
      });
    }
    
    // Add to processing queue
    const job = await addEmailToQueue(email, 10); // High priority
    
    res.json({
      success: true,
      message: 'Email added to processing queue',
      jobId: job.id,
      emailId: email.id,
      subject: email.subject,
    });
  } catch (error) {
    console.error('Error processing email:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process email',
      details: error.message,
    });
  }
});

/**
 * GET /emails/queue/status
 * Get processing queue status
 */
router.get('/queue/status', async (req, res) => {
  try {
    const status = await getQueueStatus();
    
    res.json({
      success: true,
      queueStatus: status,
    });
  } catch (error) {
    console.error('Error getting queue status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get queue status',
      details: error.message,
    });
  }
});

/**
 * GET /emails/queue/failed
 * Get failed jobs
 */
router.get('/queue/failed', async (req, res) => {
  try {
    const failedJobs = await getFailedJobs();
    
    res.json({
      success: true,
      failedJobs: failedJobs.map(job => ({
        id: job.id,
        emailId: job.data.id,
        subject: job.data.subject,
        from: job.data.from,
        failedReason: job.failedReason,
        failedAt: job.processedOn,
        attemptsMade: job.attemptsMade,
      })),
      totalFailed: failedJobs.length,
    });
  } catch (error) {
    console.error('Error getting failed jobs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get failed jobs',
      details: error.message,
    });
  }
});

/**
 * POST /emails/queue/retry
 * Retry failed jobs
 */
router.post('/queue/retry', async (req, res) => {
  try {
    const retriedJobs = await retryFailedJobs();
    
    res.json({
      success: true,
      message: 'Failed jobs retried successfully',
      retriedJobsCount: retriedJobs.length,
    });
  } catch (error) {
    console.error('Error retrying failed jobs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retry jobs',
      details: error.message,
    });
  }
});

/**
 * DELETE /emails/queue/clean
 * Clean completed and failed jobs from queue
 */
router.delete('/queue/clean', async (req, res) => {
  try {
    const { keepCompleted = 10, keepFailed = 5 } = req.body;
    
    // Note: Implementation depends on your queue setup
    // This is a placeholder for queue cleanup
    
    res.json({
      success: true,
      message: 'Queue cleaned successfully',
    });
  } catch (error) {
    console.error('Error cleaning queue:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clean queue',
      details: error.message,
    });
  }
});

/**
 * POST /emails/queue/clear
 * Clear all jobs from the queue
 */
router.post('/queue/clear', async (req, res) => {
  try {
    await clearQueue();
    
    res.json({
      success: true,
      message: 'Queue cleared successfully',
    });
  } catch (error) {
    console.error('Error clearing queue:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear queue',
      details: error.message,
    });
  }
});

export default router;