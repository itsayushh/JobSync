import { GoogleGenerativeAI } from '@google/generative-ai';
import regexPatterns from '../config/regexPattern.js';
import config from '../config/index.js';

class ParsingService {
  constructor() {
    // Instantiate API client
    this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);

    // Prepare model instance for reuse
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-lite',
    });
  }

  async parseEmail(emailData) {
    try {
      const regexResult = this.extractWithRegex(emailData);

      const geminiResult = await this.enhanceWithGemini(emailData, regexResult);

      return {
        ...regexResult,
        ...(geminiResult || {}),
        gmailLink: emailData.gmailLink,
        processedAt: new Date(),
      };
    } catch (error) {
      console.error('Error parsing email:', error);
      throw error;
    }
  }

  extractWithRegex(emailData) {
    const { subject, from, body, date } = emailData;

    return {
      company: this.extractCompany(from, body, subject),
      role: this.extractRole(subject, body),
      platform: this.extractPlatform(from, body, subject),
      status: this.extractStatus(subject, body),
      applicationDate: this.extractApplicationDate(body, date),
      lastResponseDate: date,
    };
  }

  extractCompany(from, body, subject) {
    const emailMatch = from.match(/([A-Z][a-zA-Z\s&.,'-]+)\s*</);
    if (emailMatch) {
      const company = emailMatch[1].trim();
      if (!this.isGenericSender(company)) {
        return company;
      }
    }

    const text = `${subject} ${body}`;
    for (const pattern of regexPatterns.companyPatterns) {
      const match = text.match(pattern);
      if (match && match[1] && !this.isGenericSender(match[1])) {
        return match[1].trim();
      }
    }

    const domainMatch = from.match(/@([^.]+)/);
    if (domainMatch) {
      return this.formatCompanyName(domainMatch[1]);
    }

    return 'Unknown';
  }

  extractRole(subject, body) {
    const text = `${subject} ${body}`;
    for (const pattern of regexPatterns.rolePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    const jobTitles = [
      'Software Engineer', 'Developer', 'Frontend Developer', 'Backend Developer',
      'Full Stack Developer', 'Data Scientist', 'Product Manager', 'Designer',
      'DevOps Engineer', 'QA Engineer', 'Business Analyst', 'Marketing Manager',
    ];
    for (const title of jobTitles) {
      if (text.toLowerCase().includes(title.toLowerCase())) {
        return title;
      }
    }

    return 'Not specified';
  }

  extractPlatform(from, body, subject) {
    const text = `${from} ${body} ${subject}`.toLowerCase();
    for (const [platform, pattern] of Object.entries(regexPatterns.platforms)) {
      if (pattern.test(text)) {
        return platform.charAt(0).toUpperCase() + platform.slice(1);
      }
    }
    return 'Direct';
  }

  extractStatus(subject, body) {
    const text = `${subject} ${body}`.toLowerCase();
    for (const [status, keywords] of Object.entries(regexPatterns.statusKeywords)) {
      if (keywords.some(keyword => text.includes(keyword.toLowerCase()))) {
        return status.charAt(0).toUpperCase() + status.slice(1);
      }
    }
    return 'Applied';
  }

  extractApplicationDate(body, emailDate) {
    for (const pattern of regexPatterns.datePatterns) {
      const match = body.match(pattern);
      if (match) {
        const date = new Date(match[1]);
        if (!isNaN(date) && date <= new Date()) {
          return date;
        }
      }
    }
    return emailDate;
  }

  async enhanceWithGemini(emailData, regexResult) {
    try {
      const prompt = `
You are an expert at analyzing job-related emails. Analyze this email and provide structured information.

Email Details:
- Subject: ${emailData.subject}
- From: ${emailData.from}

Initial Analysis (from regex):
- Company: ${regexResult.company}
- Role: ${regexResult.role}
- Platform: ${regexResult.platform}
- Status: ${regexResult.status}

Instructions:
1. Determine if this is actually a job-related email (hiring, application, interview, etc.)
2. Extract or correct the company name
3. Extract or correct the job role/position
4. Determine the application status: Applied, Interview, Offer, or Rejected
5. Identify the platform (LinkedIn, Indeed, Direct, etc.)

Respond in this exact JSON format:
{
  "isJobRelated": true/false,
  "company": "company name",
  "role": "job role",
  "status": "Applied|Interview|Offer|Rejected",
  "platform": "platform name",
  "confidence": 0.0-1.0
}
`;

      const result = await this.model.generateContent(prompt);
      const text = result.response.text();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.isJobRelated && parsed.confidence > 0.6) {
          return {
            company: parsed.company || regexResult.company,
            role: parsed.role || regexResult.role,
            status: parsed.status || regexResult.status,
            platform: parsed.platform || regexResult.platform,
            isJobRelated: parsed.isJobRelated,
            confidence: parsed.confidence,
          };
        }
      }
      return null;
    } catch (error) {
      console.error('Error with Gemini processing:', error);
      return regexResult;
    }
  }

  isGenericSender(name) {
    const generic = [
      'noreply', 'no-reply', 'donotreply', 'admin', 'support', 'info',
      'notification', 'alert', 'system', 'automated', 'bot'
    ];
    return generic.some(g => name.toLowerCase().includes(g));
  }

  formatCompanyName(domain) {
    return domain
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

export default ParsingService;
