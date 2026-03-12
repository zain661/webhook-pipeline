import { pgTable, uuid, text, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const pipelines = pgTable('pipelines', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  source_token: uuid('source_token').notNull().unique().defaultRandom(),
  action_type: text('action_type').notNull(),
  action_config: jsonb('action_config').notNull().default({}),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
});

export const pipeline_subscribers = pgTable('pipeline_subscribers', {
  id: uuid('id').primaryKey().defaultRandom(),
  pipeline_id: uuid('pipeline_id')
    .notNull()
    .references(() => pipelines.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  created_at: timestamp('created_at').notNull().defaultNow(),
});

export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  pipeline_id: uuid('pipeline_id')
    .notNull()
    .references(() => pipelines.id, { onDelete: 'cascade' }),
  payload: jsonb('payload').notNull(),
  status: text('status').notNull().default('pending'),
  result: jsonb('result'),
  error: text('error'),
  created_at: timestamp('created_at').notNull().defaultNow(),
  processed_at: timestamp('processed_at'),
});

export const delivery_attempts = pgTable('delivery_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  job_id: uuid('job_id')
    .notNull()
    .references(() => jobs.id, { onDelete: 'cascade' }),
  subscriber_url: text('subscriber_url').notNull(),
  status: text('status').notNull(),
  attempt_number: text('attempt_number').notNull(),
  response_code: text('response_code'),
  error: text('error'),
  attempted_at: timestamp('attempted_at').notNull().defaultNow(),
});
