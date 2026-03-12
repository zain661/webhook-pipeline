export type ActionType =
  | 'field_normalizer'
  | 'severity_classifier'
  | 'keyword_alert'
  | 'response_enricher';
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type DeliveryStatus = 'success' | 'failed';

export interface Pipeline {
  id: string;
  name: string;
  source_token: string;
  action_type: ActionType;
  action_config: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface PipelineSubscriber {
  id: string;
  pipeline_id: string;
  url: string;
  created_at: Date;
}

export interface Job {
  id: string;
  pipeline_id: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: Date;
  processed_at: Date | null;
}

export interface DeliveryAttempt {
  id: string;
  job_id: string;
  subscriber_url: string;
  status: DeliveryStatus;
  attempt_number: string;
  response_code: string | null;
  error: string | null;
  attempted_at: Date;
}

export interface CreatePipelineBody {
  name: string;
  action_type: ActionType;
  action_config: Record<string, unknown>;
  subscriber_urls: string[];
}
