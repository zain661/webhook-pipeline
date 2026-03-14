import { Queue } from 'bullmq';

export const connection = {
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',
};

export const jobQueue = new Queue('jobs', {
  connection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});
