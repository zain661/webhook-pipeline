interface ResponseWindow {
  [key: string]: string;
}

interface EnricherConfig {
  addTimestamp?: boolean;
  addPipelineId?: boolean;
  addField?: Record<string, unknown>;
  priorityMap?: ResponseWindow;
  prioritySource?: string;
}

export function runResponseEnricher(
  payload: Record<string, unknown>,
  config: Record<string, unknown>,
  pipelineId: string
): Record<string, unknown> {
  const result = { ...payload };
  const cfg = config as EnricherConfig;

  // add processed timestamp
  if (cfg.addTimestamp) {
    result.processedAt = new Date().toISOString();
  }

  // add pipeline id for traceability
  if (cfg.addPipelineId) {
    result.pipelineId = pipelineId;
  }

  // add any static fields
  if (cfg.addField) {
    Object.assign(result, cfg.addField);
  }

  // e.g. classification: "critical" → "P1 - Respond within 1 hour"
  if (cfg.priorityMap && cfg.prioritySource) {
    const classificationValue = String(result[cfg.prioritySource] ?? '');
    const responseWindow = cfg.priorityMap[classificationValue];
    if (responseWindow) {
      result.responseWindow = responseWindow;
    }
  }

  return result;
}
