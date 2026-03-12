import { eq, desc, and } from "drizzle-orm";
import { db } from "../client";
import { jobs } from "../schema";
import type { Job } from "../../types";

export async function createJob(
  pipeline_id: string,
  payload: Record<string, unknown>,
): Promise<Job> {
  const result = await db
    .insert(jobs)
    .values({ pipeline_id, payload })
    .returning();
  return result[0] as Job;
}

export async function getJobById(id: string): Promise<Job | null> {
  const result = await db.select().from(jobs).where(eq(jobs.id, id));
  return (result[0] ?? null) as Job | null;
}

export async function getAllJobs(): Promise<Job[]> {
  const result = await db.select().from(jobs).orderBy(jobs.created_at);
  return result as Job[];
}

export async function getPendingJobs(): Promise<Job[]> {
  const result = await db.select().from(jobs).where(eq(jobs.status, "pending"));
  return result as Job[];
}

export async function updateJobStatus(
  id: string,
  status: string,
  result?: Record<string, unknown>,
  error?: string,
): Promise<void> {
  await db
    .update(jobs)
    .set({
      status,
      ...(result && { result }),
      ...(error && { error }),
      ...(status === "completed" || status === "failed"
        ? { processed_at: new Date() }
        : {}),
    })
    .where(eq(jobs.id, id));
}

export async function getJobsByFilter(filters: {
  status?: string;
  pipeline_id?: string;
}): Promise<Job[]> {
  const conditions = [];

  if (filters.status) {
    conditions.push(eq(jobs.status, filters.status));
  }

  if (filters.pipeline_id) {
    conditions.push(eq(jobs.pipeline_id, filters.pipeline_id));
  }

  const result = await db
    .select()
    .from(jobs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(jobs.created_at)); // newest first

  return result as Job[];
}
