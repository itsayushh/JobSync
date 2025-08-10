import express from 'express';
import GmailService from '../services/gmail.js';
import NotionService from '../services/notion.js';
import ParsingService from '../services/parsing.js';
import { addEmailToQueue, getQueueStatus } from '../queue/email.js';

const router = express.Router();
const gmailService = new GmailService();
const notionService = new NotionService();
const parsingService = new ParsingService();

/**
 * GET /jobs
 * Get all job applications with filtering and pagination
 */
router.get('/', async (req, res) => {
  try {
    const {
      status,
      company,
      platform,
      dateFrom,
      dateTo,
      limit = 20,
      cursor,
      sortBy = 'lastResponseDate',
      sortOrder = 'desc',
    } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (company) filters.company = company;
    if (platform) filters.platform = platform;
    if (dateFrom || dateTo) {
      filters.dateRange = { from: dateFrom, to: dateTo };
    }

    const applications = await notionService.getAllApplications();

    res.json({
      success: true,
      jobs: applications.results,
    //   pagination: {
    //     hasMore: applications.has_more,
    //     nextCursor: applications.next_cursor,
    //     totalShown: applications.results.length,
    //   },
      filters: {
        applied: filters,
        available: {
          statuses: ['Applied', 'Interview', 'Assessment', 'Offer', 'Rejected', 'Withdrawn'],
          platforms: ['LinkedIn', 'Indeed', 'Company Website', 'Glassdoor', 'AngelList', 'Other'],
        },
      },
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch job applications',
      details: error.message,
    });
  }
});

/**
 * GET /jobs/:id
 * Get specific job application with full details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const job = await notionService.getApplicationById(id);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job application not found',
      });
    }

    res.json({
      success: true,
      job,
    });
  } catch (error) {
    console.error('Error fetching job:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch job application',
      details: error.message,
    });
  }
});

/**
 * POST /jobs
 * Create new job application manually
 */
router.post('/', async (req, res) => {
  try {
    const jobData = req.body;
    
    // Validate required fields
    const requiredFields = ['company', 'role'];
    const missingFields = requiredFields.filter(field => !jobData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        missingFields,
      });
    }

    console.log('Job data:', jobData);

    // Set default values
    const applicationData = {
      company: jobData.company,
      role: jobData.role,
      status: jobData.status || 'Applied',
      platform: jobData.platform || 'Manual Entry',
      applicationDate: jobData.applicationDate || new Date().toISOString(),
      lastResponseDate: new Date().toISOString(),
      notes: jobData.notes || '',
      salary: jobData.salary || '',
      location: jobData.location || '',
      jobUrl: jobData.jobUrl || '',
      contactPerson: jobData.contactPerson || '',
      ...jobData,
    };

    const createdJob = await notionService.createApplication(applicationData);

    res.status(201).json({
      success: true,
      message: 'Job application created successfully',
      job: createdJob,
    });
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create job application',
      details: error.message,
    });
  }
});

/**
 * PUT /jobs/:id
 * Update job application
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Add last updated timestamp
    updateData.lastResponseDate = new Date().toISOString();

    const updatedJob = await notionService.updateApplication(id, updateData);

    res.json({
      success: true,
      message: 'Job application updated successfully',
      job: updatedJob,
    });
  } catch (error) {
    console.error('Error updating job:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update job application',
      details: error.message,
    });
  }
});

/**
 * DELETE /jobs/:id
 * Archive/soft delete job application
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent = false } = req.query;

    if (permanent) {
      // Permanent deletion (if supported by Notion service)
      await notionService.deleteApplication(id);
    } else {
      // Archive (soft delete)
      await notionService.archiveApplication(id);
    }

    res.json({
      success: true,
      message: permanent ? 'Job application deleted permanently' : 'Job application archived',
    });
  } catch (error) {
    console.error('Error deleting job:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete job application',
      details: error.message,
    });
  }
});

/**
 * GET /jobs/stats/overview
 * Get job application statistics and analytics
 */
router.get('/stats/overview', async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    const stats = await notionService.getDatabaseStats(period);

    res.json({
      success: true,
      stats: {
        ...stats,
        period,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching job stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch job statistics',
      details: error.message,
    });
  }
});

/**
 * POST /jobs/import/email/:emailId
 * Import job application from specific email
 */
router.post('/import/email/:emailId', async (req, res) => {
  try {
    const { emailId } = req.params;
    const { priority = 5 } = req.body;

    // Get the email data
    const emails = await gmailService.getJobEmails(100, 30);
    const email = emails.find(e => e.id === emailId);

    if (!email) {
      return res.status(404).json({
        success: false,
        error: 'Email not found',
      });
    }

    // Parse the email first to check if it's job-related
    const parsedData = await parsingService.parseEmail(email);

    if (!parsedData || parsedData.isJobRelated === false) {
      return res.status(400).json({
        success: false,
        error: 'Email is not job-related',
        emailData: {
          subject: email.subject,
          from: email.from,
          date: email.date,
        },
      });
    }

    // Add to processing queue for Notion update
    const job = await addEmailToQueue(email, priority);

    res.json({
      success: true,
      message: 'Email imported and queued for processing',
      jobId: job.id,
      parsedData,
      estimatedProcessingTime: '1-2 minutes',
    });
  } catch (error) {
    console.error('Error importing email:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to import email',
      details: error.message,
    });
  }
});

/**
 * POST /jobs/bulk-import
 * Bulk import job applications from recent emails
 */
router.post('/bulk-import', async (req, res) => {
  try {
    const { 
      daysBack = 7, 
      maxEmails = 50, 
      autoProcess = true 
    } = req.body;

    // Fetch recent job-related emails
    const emails = await gmailService.getJobEmails(maxEmails, daysBack);

    if (emails.length === 0) {
      return res.json({
        success: true,
        message: 'No job-related emails found for import',
        emailsFound: 0,
      });
    }

    let processedCount = 0;
    let queuedCount = 0;
    const results = [];

    for (const email of emails) {
      try {
        // Quick parse to check if job-related
        const parsedData = await parsingService.parseEmail(email);
        
        if (parsedData && parsedData.isJobRelated !== false) {
          if (autoProcess) {
            // Add to queue for automatic processing
            await addEmailToQueue(email, 3);
            queuedCount++;
          }
          processedCount++;
          
          results.push({
            emailId: email.id,
            subject: email.subject,
            from: email.from,
            company: parsedData.company,
            role: parsedData.role,
            status: autoProcess ? 'queued' : 'identified',
          });
        }
      } catch (error) {
        console.warn(`Failed to process email ${email.id}:`, error.message);
      }
    }

    res.json({
      success: true,
      message: `Bulk import completed`,
      summary: {
        emailsScanned: emails.length,
        jobEmailsFound: processedCount,
        emailsQueued: queuedCount,
        estimatedProcessingTime: autoProcess ? `${Math.ceil(queuedCount / 3)} minutes` : 'N/A',
      },
      results,
    });
  } catch (error) {
    console.error('Error in bulk import:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform bulk import',
      details: error.message,
    });
  }
});

/**
 * GET /jobs/search
 * Search job applications
 */
router.get('/search', async (req, res) => {
  try {
    const { 
      q: query, 
      fields = 'company,role,notes', 
      limit = 20 
    } = req.query;

    if (!query || query.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Search query is required',
      });
    }

    const searchResults = await notionService.searchApplications(
      query.trim(),
      fields.split(','),
      parseInt(limit)
    );

    res.json({
      success: true,
      query,
      results: searchResults,
      totalFound: searchResults.length,
    });
  } catch (error) {
    console.error('Error searching jobs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search job applications',
      details: error.message,
    });
  }
});

export default router;