import { getPendingJobs, updateJobStatus } from "../db/queries/jobs";
import {
  getPipelineById,
  getSubscribersByPipelineId,
} from "../db/queries/pipelines";
import { runAction } from "../actions";
import { deliverToSubscriber } from "./delivery";

const POLL_INTERVAL = 3000; // check every 3 seconds

async function processJob(jobId: string): Promise<void> {
  console.log(`Processing job ${jobId}`);

  await updateJobStatus(jobId, "processing");

  try {
    const { getJobById } = await import("../db/queries/jobs");
    const job = await getJobById(jobId);
    if (!job) throw new Error("Job not found");

    const pipeline = await getPipelineById(job.pipeline_id);
    if (!pipeline) throw new Error("Pipeline not found");

    const result = runAction(job.payload, pipeline);

    if (result === null) {
      console.log(`Job ${jobId} filtered out — no delivery`);
      await updateJobStatus(jobId, "completed", {}, undefined);
      return;
    }

    await updateJobStatus(jobId, "completed", result, undefined);

    const subscribers = await getSubscribersByPipelineId(pipeline.id);
    for (const subscriber of subscribers) {
      await deliverToSubscriber(jobId, subscriber, result);
    }
  } catch (err) {
    console.error(`Job ${jobId} failed:`, err);
    await updateJobStatus(jobId, "failed", undefined, String(err));
  }
}

async function poll(): Promise<void> {
  try {
    const pendingJobs = await getPendingJobs();

    for (const job of pendingJobs) {
      await processJob(job.id);
    }
  } catch (err) {
    console.error("Worker poll error:", err);
  }

  // Schedule next poll
  setTimeout(poll, POLL_INTERVAL);
}

console.log("Worker started, polling every", POLL_INTERVAL / 1000, "seconds");
poll();
