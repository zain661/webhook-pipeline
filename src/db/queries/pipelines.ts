import { eq } from 'drizzle-orm';
import { db } from '../client';
import { pipelines, pipeline_subscribers } from '../schema';
import type { CreatePipelineBody, Pipeline, PipelineSubscriber } from '../../types';

export async function createPipeline(data: CreatePipelineBody): Promise<Pipeline> {
  return await db.transaction(async (tx) => {
    const [pipeline] = await tx
      .insert(pipelines)
      .values({
        name: data.name,
        action_type: data.action_type,
        action_config: data.action_config ?? {},
      })
      .returning();

    for (const url of data.subscriber_urls) {
      await tx.insert(pipeline_subscribers).values({ pipeline_id: pipeline!.id, url });
    }

    return pipeline as Pipeline;
  });
}

export async function getAllPipelines(): Promise<Pipeline[]> {
  return db.select().from(pipelines) as Promise<Pipeline[]>;
}

export async function getPipelineById(id: string): Promise<Pipeline | null> {
  const result = await db.select().from(pipelines).where(eq(pipelines.id, id));
  return (result[0] ?? null) as Pipeline | null;
}

export async function getPipelineByToken(token: string): Promise<Pipeline | null> {
  const result = await db.select().from(pipelines).where(eq(pipelines.source_token, token));
  return (result[0] ?? null) as Pipeline | null;
}

export async function updatePipeline(
  id: string,
  data: Partial<CreatePipelineBody>
): Promise<Pipeline | null> {
  const result = await db
    .update(pipelines)
    .set({
      ...(data.name && { name: data.name }),
      ...(data.action_type && { action_type: data.action_type }),
      ...(data.action_config && { action_config: data.action_config }),
      updated_at: new Date(),
    })
    .where(eq(pipelines.id, id))
    .returning();
  return (result[0] ?? null) as Pipeline | null;
}

export async function deletePipeline(id: string): Promise<boolean> {
  const result = await db.delete(pipelines).where(eq(pipelines.id, id)).returning();
  return result.length > 0;
}

export async function getSubscribersByPipelineId(
  pipelineId: string
): Promise<PipelineSubscriber[]> {
  return db
    .select()
    .from(pipeline_subscribers)
    .where(eq(pipeline_subscribers.pipeline_id, pipelineId)) as Promise<PipelineSubscriber[]>;
}
