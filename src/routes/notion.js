import express from 'express';
import NotionService from '../services/notion.js';

const router = express.Router();
const notionService = new NotionService();

/**
 * GET /notion/applications
 * Get all job applications from Notion database
 */
router.get('/applications', async (req, res) => {
  try {
    const { 
      status, 
      company, 
      platform, 
      limit = 50, 
      cursor 
    } = req.query;

    const applications = await notionService.getApplications({
      status,
      company,
      platform,
      limit: parseInt(limit),
      cursor,
    });

    res.json({
      success: true,
      applications: applications.results,
      hasMore: applications.has_more,
      nextCursor: applications.next_cursor,
      totalCount: applications.results.length,
    });
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch applications',
      details: error.message,
    });
  }
});

/**
 * GET /notion/applications/:id
 * Get specific application by ID
 */
router.get('/applications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const application = await notionService.getApplicationById(id);
    
    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Application not found',
      });
    }

    res.json({
      success: true,
      application,
    });
  } catch (error) {
    console.error('Error fetching application:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch application',
      details: error.message,
    });
  }
});

/**
 * POST /notion/applications
 * Create new job application
 */
router.post('/applications', async (req, res) => {
  try {
    const applicationData = req.body;
    
    // Validate required fields
    const requiredFields = ['company', 'role'];
    const missingFields = requiredFields.filter(field => !applicationData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        missingFields,
      });
    }
    console.log(`Creating new application: ${applicationData}`);
    const createdApplication = await notionService.createApplication(applicationData);

    res.status(201).json({
      success: true,
      message: 'Application created successfully',
      application: createdApplication,
    });
  } catch (error) {
    console.error('Error creating application:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create application',
      details: error.message,
    });
  }
});

/**
 * PUT /notion/applications/:id
 * Update existing application
 */
router.put('/applications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const updatedApplication = await notionService.updateApplication(id, updateData);

    res.json({
      success: true,
      message: 'Application updated successfully',
      application: updatedApplication,
    });
  } catch (error) {
    console.error('Error updating application:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update application',
      details: error.message,
    });
  }
});

/**
 * DELETE /notion/applications/:id
 * Delete application (archive in Notion)
 */
router.delete('/applications/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await notionService.archiveApplication(id);

    res.json({
      success: true,
      message: 'Application archived successfully',
    });
  } catch (error) {
    console.error('Error archiving application:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to archive application',
      details: error.message,
    });
  }
});

/**
 * GET /notion/stats
 * Get application statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await notionService.getApplicationStats();

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      details: error.message,
    });
  }
});

/**
 * POST /notion/sync
 * Manual sync with database
 */
router.post('/sync', async (req, res) => {
  try {
    const { forceSync = false } = req.body;
    
    const syncResult = await notionService.syncDatabase(forceSync);

    res.json({
      success: true,
      message: 'Database sync completed',
      syncResult,
    });
  } catch (error) {
    console.error('Error syncing database:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync database',
      details: error.message,
    });
  }
});

/**
 * GET /notion/database/properties
 * Get database schema/properties
 */
router.get('/database/properties', async (req, res) => {
  try {
    const properties = await notionService.getDatabaseStats();

    res.json({
      success: true,
      properties,
    });
  } catch (error) {
    console.error('Error fetching database properties:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch database properties',
      details: error.message,
    });
  }
});

export default router;