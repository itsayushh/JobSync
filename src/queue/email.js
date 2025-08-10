import { delay, Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import config from '../config/index.js';

// Redis connection
const connection = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null, // Required for BullMQ
  retryDelayOnFailover: 100,
});


// Email processing queue
const emailQueue = new Queue('email-processing', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

/**
 * Add email to processing queue
 */
async function addEmailToQueue(emailData, priority = 0) {
  try {
    const job = await emailQueue.add(
      'process-email',
      emailData,
      {
        priority, // Higher number = higher priority
        delay: 5000, // Process after 5 seconds
      }
    );
    
    console.log(`Added email to queue: ${job.id} - ${emailData.subject}`);
    return job;
  } catch (error) {
    console.error('Error adding email to queue:', error);
    throw error;
  }
}

/**
 * Add bulk emails to queue
 */
async function addBulkEmailsToQueue(emails) {
  try {
    console.log(`Adding ${emails.length} emails to queue`,emails);
    const jobs = emails.map((email, index) => ({
      name: 'process-email',
      data: email,
      delay: 5000, // Process after 5 seconds
      opts: {
        priority: 10 - index, // First emails get higher priority
      },
    }));

    const result = await emailQueue.addBulk(jobs);
    console.log(`Added ${result.length} emails to queue`);
    return result;
  } catch (error) {
    console.error('Error adding bulk emails to queue:', error);
    throw error;
  }
}

/**
 * Get queue status
 */
async function getQueueStatus() {
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      emailQueue.getWaiting(),
      emailQueue.getActive(),
      emailQueue.getCompleted(),
      emailQueue.getFailed(),
      emailQueue.getDelayed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
    };
  } catch (error) {
    console.error('Error getting queue status:', error);
    return null;
  }
}

/**
 * Clear queue (useful for development)
 */
async function clearQueue() {
  try {
    await emailQueue.obliterate({ force: true });
    console.log('Queue cleared');
  } catch (error) {
    console.error('Error clearing queue:', error);
  }
}

/**
 * Get failed jobs with reasons
 */
async function getFailedJobs(limit = 10) {
  try {
    const failedJobs = await emailQueue.getFailed(0, limit - 1);
    return failedJobs.map(job => ({
      id: job.id,
      data: job.data,
      failedReason: job.failedReason,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    }));
  } catch (error) {
    console.error('Error getting failed jobs:', error);
    return [];
  }
}

/**
 * Retry failed jobs
 */
async function retryFailedJobs() {
  try {
    const failedJobs = await emailQueue.getFailed();
    console.log(`Retrying ${failedJobs.length} failed jobs`);
    
    for (const job of failedJobs) {
      await job.retry();
    }
    
    return failedJobs.length;
  } catch (error) {
    console.error('Error retrying failed jobs:', error);
    return 0;
  }
}

/**
 * Add periodic job to sync emails
 */
async function addPeriodicSyncJob(cronExpression = '*/30 * * * *') {
  try {
    const job = await emailQueue.add(
      'sync-emails',
      {},
      {
        repeat: {
          pattern: cronExpression,
        },
        jobId: 'periodic-email-sync', // Ensures only one periodic job exists
      }
    );
    
    console.log(`Added periodic sync job with pattern: ${cronExpression}`);
    return job;
  } catch (error) {
    console.error('Error adding periodic sync job:', error);
    throw error;
  }
}

export {
  emailQueue,
  addEmailToQueue,
  addBulkEmailsToQueue,
  getQueueStatus,
  clearQueue,
  getFailedJobs,
  retryFailedJobs,
  addPeriodicSyncJob,
  connection,
};