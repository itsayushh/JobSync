import { Worker } from 'bullmq';
import ParsingService from '../services/parsing.js';
import NotionService from '../services/notion.js';
import GmailService from '../services/gmail.js';
import { connection } from '../queue/email.js';

class EmailProcessor {
  constructor() {
    this.parsingService = new ParsingService();
    this.notionService = new NotionService();
    this.gmailService = new GmailService();
    
    this.worker = new Worker(
      'email-processing',
      this.processJob.bind(this),
      {
        connection,
        concurrency: 2, // Process 2 jobs concurrently
        stalledInterval: 30000, // 30 seconds
        maxStalledCount: 1,
      }
    );

    this.setupEventListeners();
  }

  /**
   * Process individual job from the queue
   */
  async processJob(job) {
    const { name, data } = job;
    
    try {
      console.log(`Processing job: ${job.id} - ${name}`);
      
      switch (name) {
        case 'process-email':
          return await this.processEmail(data);
        case 'sync-emails':
          return await this.syncEmails();
        default:
          throw new Error(`Unknown job type: ${name}`);
      }
    } catch (error) {
      console.error(`Error processing job ${job.id}:`, error);
      throw error;
    }
  }

  /**
   * Process individual email
   */
  async processEmail(emailData) {
    try {
      console.log(`Processing email: ${emailData.subject}`);
      
      // Update job progress
      await this.updateProgress(20, 'Parsing email...');
      
      // Parse email with regex + Gemini
      const parsedData = await this.parsingService.parseEmail(emailData);
      
      // If Gemini determined it's not job-related, skip it
      if (!parsedData || parsedData.isJobRelated === false) {
        console.log(`Skipping non-job-related email: ${emailData.subject}`);
        return { skipped: true, reason: 'Not job-related' };
      }
      
      await this.updateProgress(60, 'Updating Notion database...');
      
      // Update Notion database
      const notionResult = await this.notionService.createOrUpdateApplication(parsedData);
      
      await this.updateProgress(100, 'Completed');
      
      return {
        success: true,
        emailId: emailData.id,
        company: parsedData.company,
        role: parsedData.role,
        status: parsedData.status,
        notionPageId: notionResult.id,
        confidence: parsedData.confidence,
      };
    } catch (error) {
      console.error('Error processing email:', error);
      throw error;
    }
  }

  /**
   * Sync emails (periodic job)
   */
  async syncEmails() {
    try {
      console.log('Starting email sync...');
      
      await this.updateProgress(10, 'Fetching emails from Gmail...');
      
      // Fetch recent emails
      const emails = await this.gmailService.getJobEmails(50, 7); // Last 7 days
      
      await this.updateProgress(30, `Found ${emails.length} emails to process`);
      
      let processed = 0;
      let skipped = 0;
      let errors = 0;
      
      // Process emails one by one to avoid overwhelming the APIs
      for (let i = 0; i < emails.length; i++) {
        const email = emails[i];
        
        try {
          const result = await this.processEmail(email);
          
          if (result.skipped) {
            skipped++;
          } else {
            processed++;
          }
          
          // Update progress
          const progress = 30 + (i / emails.length) * 60;
          await this.updateProgress(
            progress,
            `Processed ${i + 1}/${emails.length} emails`
          );
          
          // Small delay to avoid rate limits
          await this.delay(500);
        } catch (error) {
          console.error(`Error processing email ${email.id}:`, error);
          errors++;
        }
      }
      
      await this.updateProgress(100, 'Sync completed');
      
      const result = {
        success: true,
        totalEmails: emails.length,
        processed,
        skipped,
        errors,
        timestamp: new Date(),
      };
      
      console.log('Email sync completed:', result);
      return result;
    } catch (error) {
      console.error('Error in email sync:', error);
      throw error;
    }
  }

  /**
   * Update job progress
   */
  async updateProgress(progress, message) {
    if (this.currentJob) {
      await this.currentJob.updateProgress({
        progress,
        message,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Setup event listeners for the worker
   */
  setupEventListeners() {
    this.worker.on('active', (job) => {
      this.currentJob = job;
      console.log(`Job ${job.id} started: ${job.name}`);
    });

    this.worker.on('completed', (job, result) => {
      console.log(`Job ${job.id} completed:`, result);
      this.currentJob = null;
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Job ${job.id} failed:`, err.message);
      this.currentJob = null;
    });

    this.worker.on('stalled', (jobId) => {
      console.warn(`Job ${jobId} stalled`);
    });

    this.worker.on('error', (err) => {
      console.error('Worker error:', err);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('Received SIGTERM, closing worker...');
      await this.worker.close();
    });

    process.on('SIGINT', async () => {
      console.log('Received SIGINT, closing worker...');
      await this.worker.close();
    });
  }

  /**
   * Utility function for delays
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get worker status
   */
  getStatus() {
    return {
      isRunning: !this.worker.closing,
      concurrency: this.worker.opts.concurrency,
      processed: this.worker.processed,
      processing: this.worker.processing,
    };
  }

  /**
   * Close the worker
   */
  async close() {
    console.log('Closing email processor worker...');
    await this.worker.close();
  }
}

// Start the worker if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Starting Email Processor Worker...');
  const processor = new EmailProcessor();
  
  console.log('Email Processor Worker started successfully');
  console.log('Press Ctrl+C to stop');
}

export default EmailProcessor;