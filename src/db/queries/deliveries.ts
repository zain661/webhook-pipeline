import { eq } from 'drizzle-orm';
import { db } from '../client';
import { delivery_attempts } from '../schema';
import type { DeliveryAttempt } from '../../types';

export async function getDeliveryAttemptsByJobId(jobId: string): Promise<DeliveryAttempt[]> {
  const result = await db
    .select()
    .from(delivery_attempts)
    .where(eq(delivery_attempts.job_id, jobId))
    .orderBy(delivery_attempts.attempted_at);
  return result as DeliveryAttempt[];
}
