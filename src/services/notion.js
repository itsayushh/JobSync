import { Client } from '@notionhq/client';
import config from '../config/index.js';

class NotionService {
  constructor() {
    this.notion = new Client({
      auth: config.notion.apiKey,
    });
    this.databaseId = config.notion.databaseId;
  }

  /**
   * Create or update job application in Notion database
   */
  async createOrUpdateApplication(applicationData) {
    try {
      // Check if application already exists
      const existingApp = await this.findExistingApplication(
        applicationData.company,
        applicationData.role,
        applicationData.gmailLink
      );

      if (existingApp) {
        console.log(`Updating existing application: ${applicationData.company} - ${applicationData.role}`);
        return await this.updateApplication(existingApp.id, applicationData);
      } else {
        console.log(`Creating new application: ${applicationData.company} - ${applicationData.role}`);
        return await this.createApplication(applicationData);
      }
    } catch (error) {
      console.error('Error in createOrUpdateApplication:', error);
      throw error;
    }
  }

  /**
   * Find existing application in database
   */
  async findExistingApplication(company, role, gmailLink) {
    try {
      const response = await this.notion.databases.query({
        database_id: this.databaseId,
        filter: {
          and: [
            {
              property: 'Company',
              rich_text: {
                contains: company,
              },
            },
            {
              property: 'Role',
              rich_text: {
                contains: role,
              },
            },
          ],
        },
      });

      // Also check by Gmail link if available (only if the column exists)
      if (gmailLink && response.results.length === 0) {
        try {
          const linkResponse = await this.notion.databases.query({
            database_id: this.databaseId,
            filter: {
              property: 'Gmail Link',
              url: {
                equals: gmailLink,
              },
            },
          });
          return linkResponse.results.length > 0 ? linkResponse.results[0] : null;
        } catch (error) {
          // If Gmail Link column doesn't exist, just skip this check
          console.warn('Gmail Link property not found in database, skipping link-based search');
        }
      }

      return response.results.length > 0 ? response.results[0] : null;
    } catch (error) {
      console.error('Error finding existing application:', error);
      return null;
    }
  }

  /**
   * Create new application in Notion
   */
  async createApplication(data) {
    try {
      const response = await this.notion.pages.create({
        parent: {
          database_id: this.databaseId,
        },
        properties: this.buildNotionProperties(data),
      });

      console.log(`Created application: ${response.id}`);
      return response;
    } catch (error) {
      console.error('Error creating application:', error);
      throw error;
    }
  }

  /**
   * Update existing application in Notion
   */
  async updateApplication(pageId, data) {
    try {
      const response = await this.notion.pages.update({
        page_id: pageId,
        properties: this.buildNotionProperties(data, true),
      });

      console.log(`Updated application: ${pageId}`);
      return response;
    } catch (error) {
      console.error('Error updating application:', error);
      throw error;
    }
  }

  /**
   * Build Notion properties object
   */
  buildNotionProperties(data, isUpdate = false) {
    console.log(`Building Notion properties for ${isUpdate ? 'update' : 'creation'}:`, data);

    const properties = {
      'Company': {
        title: [
          {
            text: {
              content: data.company || 'Unknown',
            },
          },
        ],
      },
      'Role': {
        rich_text: [
          {
            text: {
              content: data.role || 'Not specified',
            },
          },
        ],
      },
      'Status': {
        status: {
          name: data.status || 'Applied',
        },
      },
      'Platform': {
        rich_text: [
          {
            text: {
              content: data.platform || 'Not specified',
            },
          },
        ],
      },
      'Last Response Date': {
        date: {
          start: data.lastResponseDate || null,
        },
      },
      'Gmail Link': {
        url: data.gmailLink || null, // URL type property
      },
    };
    
    if (!isUpdate) {
      properties['Application Date'] = {
        date: {
          start: data.applicationDate || null,
        },
      };
    }



    return properties;
  }


  /**
   * Get all applications from database
   */
  async getAllApplications() {
    try {
      const response = await this.notion.databases.query({
        database_id: this.databaseId,
        sorts: [
          {
            property: 'Last Response Date',
            direction: 'descending',
          },
        ],
      });

      return response.results;
    } catch (error) {
      console.error('Error fetching applications:', error);
      throw error;
    }
  }

  /**
   * Create the database schema (run this once to set up the database)
   */
  async createDatabase(parentPageId, title = 'Job Applications Tracker') {
    try {
      const response = await this.notion.databases.create({
        parent: {
          type: 'page_id',
          page_id: parentPageId,
        },
        title: [
          {
            type: 'text',
            text: {
              content: title,
            },
          },
        ],
        properties: {
          'Company': {
            rich_text: {},
          },
          'Role': {
            rich_text: {},
          },
          'Status': {
            select: {
              options: [
                { name: 'Applied', color: 'orange' },
                { name: 'Interview', color: 'blue' },
                { name: 'Offer', color: 'green' },
                { name: 'Offer Rejected', color: 'pink' },
                { name: 'Rejected', color: 'red' },
              ],
            },
          },
          'Platform': {
            rich_text: {},
          },
          'Application Date': {
            date: {},
          },
          'Last Response Date': {
            date: {},
          },
          'Gmail Link': {
            url: {},
          },
          'Confidence': {
            number: {
              format: 'percent',
            },
          },
        },
      });

      console.log('Database created successfully:', response.id);
      return response;
    } catch (error) {
      console.error('Error creating database:', error);
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats() {
    try {
      const applications = await this.getAllApplications();

      const stats = {
        total: applications.length,
        byStatus: {},
        byPlatform: {},
        recentApplications: 0,
      };

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      applications.forEach(app => {
        const props = app.properties;

        // Count by status
        const status = props.Status?.select?.name || 'Unknown';
        stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

        // Count by platform
        const platform = props.Platform?.select?.name || 'Unknown';
        stats.byPlatform[platform] = (stats.byPlatform[platform] || 0) + 1;

        // Count recent applications
        const appDate = props['Application Date']?.date?.start;
        if (appDate && new Date(appDate) > oneWeekAgo) {
          stats.recentApplications++;
        }
      });

      return stats;
    } catch (error) {
      console.error('Error getting database stats:', error);
      throw error;
    }
  }

  async getDatabaseById() {

  }
}

export default NotionService;