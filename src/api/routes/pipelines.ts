import { Router } from 'express';
import type { Request, Response } from 'express';
import type { CreatePipelineBody } from '../../types';
import {
  createPipeline,
  getAllPipelines,
  getPipelineById,
  updatePipeline,
  deletePipeline,
} from '../../db/queries/pipelines';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const body = req.body as CreatePipelineBody;

  if (!body.name || !body.action_type || !body.subscriber_urls?.length) {
    res.status(400).json({ error: 'name, action_type, and subscriber_urls are required' });
    return;
  }

  try {
    const pipeline = await createPipeline(body);
    res.status(201).json(pipeline);
  } catch {
    res.status(500).json({ error: 'Failed to create pipeline' });
  }
});

router.get('/', async (_req: Request, res: Response) => {
  try {
    const pipelines = await getAllPipelines();
    res.json(pipelines);
  } catch {
    res.status(500).json({ error: 'Failed to fetch pipelines' });
  }
});

router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const pipeline = await getPipelineById(req.params.id);
    if (!pipeline) {
      res.status(404).json({ error: 'Pipeline not found' });
      return;
    }
    res.json(pipeline);
  } catch {
    res.status(500).json({ error: 'Failed to fetch pipeline' });
  }
});

router.put('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const pipeline = await updatePipeline(req.params.id, req.body);
    if (!pipeline) {
      res.status(404).json({ error: 'Pipeline not found' });
      return;
    }
    res.json(pipeline);
  } catch {
    res.status(500).json({ error: 'Failed to update pipeline' });
  }
});

router.delete('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const deleted = await deletePipeline(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Pipeline not found' });
      return;
    }
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Failed to delete pipeline' });
  }
});

export default router;
