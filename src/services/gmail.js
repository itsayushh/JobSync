import { google } from 'googleapis';
import config from '../config/index.js';

class GmailService {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      config.gmail.clientId,
      config.gmail.clientSecret,
      config.gmail.redirectUri
    );

    this.oauth2Client.setCredentials({
      refresh_token: config.gmail.refreshToken,
    });

    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  /**
   * Get job-related emails from Gmail
   */
  async getJobEmails(maxResults = 30, daysBack = 30) {
    try {
      // Calculate date for filtering (30 days back)
      const dateFilter = new Date();
      dateFilter.setDate(dateFilter.getDate() - daysBack);
      const dateString = dateFilter.toISOString().split('T')[0].replace(/-/g, '/');

      // Search query for job-related emails
      const query = [
        `after:${dateString}`,
        '(subject:application OR subject:job OR subject:position OR subject:role OR subject:career OR subject:opportunity)',
        'OR (subject:interview OR subject:screen OR subject:assessment OR subject:challenge)',
        'OR (subject:offer OR subject:congratulations OR subject:welcome or subject:thank you or subject:Thanks)',
        'OR (subject:rejection OR subject:unfortunately)',
        'OR (from:careers OR from:jobs OR from:talent OR from:recruiting OR from:hr OR from:hiring)',
        'OR (from:linkedin OR from:indeed OR from:glassdoor OR from:naukri or from:unstop or from:wellfound)',
      ].join(' ');

      console.log('Searching emails with query:', query);

      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults,
      });

      if (!response.data.messages) {
        console.log('No job-related emails found');
        return [];
      }

      console.log(`Found ${response.data.messages.length} potential job emails`);

      // Get full email details
      const emailPromises = response.data.messages.map(async (message) => {
        const email = await this.gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full',
        });
        return this.parseEmailData(email.data);
      });

      const emails = await Promise.all(emailPromises);
      return emails.filter(email => email !== null);
    } catch (error) {
      console.error('Error fetching emails:', error);
      throw error;
    }
  }

  /**
   * Parse email data into structured format
   */
  parseEmailData(emailData) {
    try {
      const headers = emailData.payload.headers;
      const getHeader = (name) => {
        const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
        return header ? header.value : '';
      };

      const subject = getHeader('Subject');
      const from = getHeader('From');
      const date = getHeader('Date');
      const messageId = emailData.id;

      // Get email body
      let body = '';
      if (emailData.payload.body && emailData.payload.body.data) {
        body = Buffer.from(emailData.payload.body.data, 'base64').toString('utf-8');
      } else if (emailData.payload.parts) {
        // Handle multipart emails
        const textPart = this.findTextPart(emailData.payload.parts);
        if (textPart && textPart.body && textPart.body.data) {
          body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
        }
      }

      // Generate Gmail link
      const gmailLink = `https://mail.google.com/mail/u/0/#inbox/${messageId}`;

      return {
        id: messageId,
        subject,
        from,
        date: new Date(date),
        body: this.cleanEmailBody(body),
        gmailLink,
        raw: emailData,
      };
    } catch (error) {
      console.error('Error parsing email data:', error);
      return null;
    }
  }

  /**
   * Find text part in multipart email
   */
  findTextPart(parts) {
    for (const part of parts) {
      if (part.mimeType === 'text/plain' || part.mimeType === 'text/html') {
        return part;
      }
      if (part.parts) {
        const textPart = this.findTextPart(part.parts);
        if (textPart) return textPart;
      }
    }
    return null;
  }

  /**
   * Clean email body text
   */
  cleanEmailBody(body) {
    if (!body) return '';
    
    // Remove HTML tags
    let cleaned = body.replace(/<[^>]*>/g, ' ');
    
    // Replace HTML entities
    cleaned = cleaned
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    
    // Remove extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    // Limit length for processing
    return cleaned.substring(0, 2000);
  }

  /**
   * Generate OAuth URL for authentication
   */
  generateAuthUrl() {
    const scopes = ['https://www.googleapis.com/auth/gmail.readonly'];
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
    });
  }

  /**
   * Get tokens from authorization code
   */
  async getTokensFromCode(code) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      return tokens;
    } catch (error) {
      console.error('Error getting tokens:', error);
      throw error;
    }
  }
}

export default GmailService;