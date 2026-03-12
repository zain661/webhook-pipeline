import { Router } from 'express';
import type { Request, Response } from 'express';
import { getAllJobs, getJobById } from '../../db/queries/jobs';
import { getDeliveryAttemptsByJobId } from '../../db/queries/deliveries';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const jobs = await getAllJobs();
    res.json(jobs);
  } catch {
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const job = await getJobById(req.params.id);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const attempts = await getDeliveryAttemptsByJobId(job.id);

    // Return job + its delivery attempts together
    res.json({
      ...job,
      delivery_attempts: attempts,
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

// GET /jobs/:id/status — just the status
router.get('/:id/status', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const job = await getJobById(req.params.id);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    res.json({
      job_id: job.id,
      status: job.status,
      created_at: job.created_at,
      processed_at: job.processed_at ?? null,
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch job status' });
  }
});

router.get('/:id/history', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const job = await getJobById(req.params.id);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    res.json({
      job_id: job.id,
      pipeline_id: job.pipeline_id,
      status: job.status,
      received_at: job.created_at,
      processed_at: job.processed_at ?? null,
      input: job.payload, // what came IN from the webhook
      output: job.result ?? null, // what came OUT after action ran
      error: job.error ?? null,
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch job history' });
  }
});

// GET /jobs/:id/attempts — delivery attempts detail
router.get('/:id/attempts', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const job = await getJobById(req.params.id);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    const attempts = await getDeliveryAttemptsByJobId(job.id);
    res.json({
      job_id: job.id,
      status: job.status,
      total_attempts: attempts.length,
      attempts,
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch delivery attempts' });
  }
});

export default router;
