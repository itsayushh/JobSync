// Regex patterns and keyword mappings for email parsing
export default {
  // Job platforms
  platforms: {
    linkedin: /linkedin\.com|from.*linkedin/i,
    indeed: /indeed\.com|from.*indeed/i,
    glassdoor: /glassdoor\.com|from.*glassdoor/i,
    naukri: /naukri\.com|from.*naukri/i,
    dice: /dice\.com|from.*dice/i,
    monster: /monster\.com|from.*monster/i,
    ziprecruiter: /ziprecruiter\.com|from.*ziprecruiter/i,
    angellist: /angel\.co|wellfound\.com|from.*angel/i,
    unstop: /unstop\.com|from.*unstop/i,
    naukri: /naukri\.com|from.*naukri/i,

  },

  // Company name extraction patterns
  companyPatterns: [
    /from:?\s*([A-Z][a-zA-Z\s&.,'-]+(?:\s(?:Inc|LLC|Corp|Company|Technologies|Tech|Solutions|Systems|Services|Group|Ltd|Limited))?)(?:\s*<|@)/i,
    /on behalf of\s+([A-Z][a-zA-Z\s&.,'-]+)/i,
    /at\s+([A-Z][a-zA-Z\s&.,'-]+(?:\s(?:Inc|LLC|Corp|Company|Technologies|Tech|Solutions|Systems|Services|Group|Ltd|Limited)))/i,
    /from\s+([A-Z][a-zA-Z\s&.,'-]+)\s+team/i,
  ],

  // Job role extraction patterns
  rolePatterns: [
    /(?:position|role|job)\s+(?:of|for|as)?\s*:?\s*([A-Z][a-zA-Z\s\-,()]+?)(?:\s+at|\s+with|\s+\-|\s*$)/i,
    /apply(?:ing)?\s+(?:for|to)\s+(?:the\s+)?(?:position\s+of\s+)?([A-Z][a-zA-Z\s\-,()]+?)(?:\s+at|\s+with|\s+role|\s*$)/i,
    /subject:.*?([A-Z][a-zA-Z\s\-,()]+?)\s+(?:position|role|opportunity|job)/i,
    /interview\s+for\s+(?:the\s+)?([A-Z][a-zA-Z\s\-,()]+?)(?:\s+position|\s+role|\s+at)/i,
  ],

  // Application status keywords
  statusKeywords: {
    applied: [
      'application received',
      'thank you for applying',
      'we have received your application',
      'application confirmation',
      'successfully applied',
      'application submitted',
    ],
    interview: [
      'interview',
      'schedule a call',
      'phone screen',
      'technical round',
      'video call',
      'meet with',
      'assessment',
      'coding challenge',
      'next round',
      'been shortlisted'
    ],
    offer: [
      'congratulations',
      'pleased to offer',
      'job offer',
      'offer letter',
      'welcome to',
      'we would like to offer',
      'excited to offer',
    ],
    rejected: [
      'unfortunately',
      'not selected',
      'other candidates',
      'decided to move forward',
      'thank you for your interest, but',
      'we have decided',
      'not proceeding',
      'position has been filled',
    ],
  },

  // Email subject patterns for job-related emails
  jobEmailSubjects: [
    /application|apply|job|position|role|career|opportunity|hiring/i,
    /interview|screen|assessment|challenge|round/i,
    /offer|congratulations|welcome/i,
    /rejection|unfortunately|not selected/i,
    /update|status|next steps/i,
  ],

  // Date extraction patterns
  datePatterns: [
    /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/,
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})/i,
    /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{2,4})/i,
  ],

  // Common job-related sender patterns
  jobSenderPatterns: [
    /@.*(?:careers|jobs|talent|recruiting|hr|hiring)\..*\.com/i,
    /noreply.*(?:career|job|talent|recruit)/i,
    /(?:talent|recruiting|hr|career|jobs)@/i,
  ],
};