import Bull from 'bull';

export const MESSAGE_QUEUE_NAME = 'message-send';

export type MessageJob = {
  campaignLeadId: string;
  includeImage: boolean;
};

const REDIS_URL = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';

export const messageQueue = new Bull<MessageJob>(MESSAGE_QUEUE_NAME, REDIS_URL, {
  limiter: { max: 20, duration: 60 * 60 * 1000 },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 60 * 1000 },
    removeOnComplete: true,
    removeOnFail: false,
  },
});
