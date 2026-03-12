import { Router } from 'express';
import type { Request, Response } from 'express';
import { getPipelineByToken } from '../../db/queries/pipelines';
import { createJob } from '../../db/queries/jobs';

const router = Router();

// POST /webhooks/ingest/:token
router.post('/ingest/:token', async (req: Request, res: Response) => {
  const token = req.params['token'] as string;
  const payload = req.body;

  // 1. Find pipeline by token
  const pipeline = await getPipelineByToken(token);
  if (!pipeline) {
    res.status(404).json({ error: 'Pipeline not found' });
    return;
  }

  // 2. Create a job — don't process it now, just queue it
  const job = await createJob(pipeline.id, payload);

  // 3. Return immediately — worker handles the rest
  res.status(202).json({
    message: 'Webhook received, job queued',
    job_id: job.id,
  });
});

export default router;
