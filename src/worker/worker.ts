import { Worker } from 'bullmq';
import { connection } from '../queues/jobQueue';
import { getJobById, updateJobStatus } from '../db/queries/jobs';
import { getPipelineById, getSubscribersByPipelineId } from '../db/queries/pipelines';
import { runAction } from '../actions';
import { deliverToSubscriber } from './delivery';

const CONCURRENCY = 5; // process 5 jobs simultaneously

const worker = new Worker(
  'jobs',
  async (queueJob) => {
    const { jobId } = queueJob.data as { jobId: string };
    console.log(`Processing job ${jobId}`);

    await updateJobStatus(jobId, 'processing');

    const job = await getJobById(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    const pipeline = await getPipelineById(job.pipeline_id);
    if (!pipeline) throw new Error(`Pipeline ${job.pipeline_id} not found`);

    const result = runAction(job.payload, pipeline);

    if (result === null) {
      console.log(`Job ${jobId} filtered out — no delivery`);
      await updateJobStatus(jobId, 'completed', {}, undefined);
      return;
    }

    await updateJobStatus(jobId, 'completed', result, undefined);

    const subscribers = await getSubscribersByPipelineId(pipeline.id);
    for (const subscriber of subscribers) {
      await deliverToSubscriber(jobId, subscriber, result);
    }
  },
  {
    connection,
    concurrency: CONCURRENCY,
  }
);

worker.on('completed', (job) => {
  console.log(`✅ Job ${job.data.jobId} completed`);
});

worker.on('failed', async (job, err) => {
  console.error(`❌ Job ${job?.data.jobId} failed:`, err.message);
  if (job?.data.jobId) {
    await updateJobStatus(job.data.jobId, 'failed', undefined, err.message);
  }
});

worker.on('error', (err) => {
  console.error('Worker error:', err.message);
});

console.log(`🚀 Worker started with BullMQ — concurrency: ${CONCURRENCY}`);
