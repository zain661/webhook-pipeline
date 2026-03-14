import { Router } from 'express';
import type { Request, Response } from 'express';
import { getPipelineByToken } from '../../db/queries/pipelines';
import { createJob } from '../../db/queries/jobs';
import { jobQueue } from '../../queues/jobQueue';

const router = Router();

router.post('/ingest/:token', async (req: Request<{ token: string }>, res: Response) => {
  try {
    const pipeline = await getPipelineByToken(req.params.token);
    if (!pipeline) {
      res.status(404).json({ error: 'Pipeline not found' });
      return;
    }

    const payload = req.body as Record<string, unknown>;

    // Save job to DB first (source of truth)
    const job = await createJob(pipeline.id, payload);

    // Determine priority based on severity score
    // Critical reports (8+) jump to front of queue
    const severityScore = Number(payload.severity_score ?? 0);
    const priority = severityScore >= 8 ? 1 : 10;

    // Push to Redis queue for instant processing
    await jobQueue.add('process', { jobId: job.id }, { priority });

    res.status(202).json({
      message: 'Webhook received, job queued',
      job_id: job.id,
    });
  } catch {
    res.status(500).json({ error: 'Failed to ingest webhook' });
  }
});

export default router;
