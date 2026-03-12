import { db } from '../db/client';
import { delivery_attempts } from '../db/schema';
import type { PipelineSubscriber } from '../types';

const MAX_ATTEMPTS = 4;

// Exponential backoff delays in ms: 30s, 2min, 10min, 30min
const BACKOFF_DELAYS = [30_000, 120_000, 600_000, 1_800_000];

export async function deliverToSubscriber(
  jobId: string,
  subscriber: PipelineSubscriber,
  result: Record<string, unknown>,
  attemptNumber: number = 1
): Promise<void> {
  try {
    const response = await fetch(subscriber.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    });

    // Record the attempt
    await db.insert(delivery_attempts).values({
      job_id: jobId,
      subscriber_url: subscriber.url,
      status: response.ok ? 'success' : 'failed',
      attempt_number: String(attemptNumber),
      response_code: String(response.status),
    });

    // If failed and we have retries left — schedule retry
    if (!response.ok && attemptNumber < MAX_ATTEMPTS) {
      const delay = BACKOFF_DELAYS[attemptNumber - 1] ?? 30_000;
      console.log(
        `Delivery failed, retrying in ${delay / 1000}s (attempt ${attemptNumber}/${MAX_ATTEMPTS})`
      );

      setTimeout(() => {
        deliverToSubscriber(jobId, subscriber, result, attemptNumber + 1);
      }, delay);
    }
  } catch (err) {
    // Network error — record and retry
    await db.insert(delivery_attempts).values({
      job_id: jobId,
      subscriber_url: subscriber.url,
      status: 'failed',
      attempt_number: String(attemptNumber),
      error: String(err),
    });

    if (attemptNumber < MAX_ATTEMPTS) {
      const delay = BACKOFF_DELAYS[attemptNumber - 1] ?? 30_000;
      console.log(
        `Network error, retrying in ${delay / 1000}s (attempt ${attemptNumber}/${MAX_ATTEMPTS})`
      );

      setTimeout(() => {
        deliverToSubscriber(jobId, subscriber, result, attemptNumber + 1);
      }, delay);
    }
  }
}
