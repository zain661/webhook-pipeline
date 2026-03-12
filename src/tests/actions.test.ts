import { describe, it, expect } from 'vitest';
import { runSeverityClassifier } from '../actions/severity_classifier';
import { runFieldNormalizer } from '../actions/field_normalizer';
import { runKeywordAlert } from '../actions/keyword_alert';
import { runResponseEnricher } from '../actions/response_enricher';

// ─────────────────────────────────────────
// severity_classifier
// ─────────────────────────────────────────
describe('severity_classifier', () => {
  const config = {
    severity_field: 'severity_score',
    drop_below: 3,
    levels: {
      critical: { operator: 'gte', value: 8 },
      high: { operator: 'gte', value: 5 },
    },
  };

  it('classifies score 9 as critical', () => {
    const result = runSeverityClassifier({ severity_score: 9, event: 'test' }, config);
    expect(result).not.toBeNull();
    expect(result?.classification).toBe('critical');
    expect(result?.escalate).toBe(true);
  });

  it('classifies score 6 as high', () => {
    const result = runSeverityClassifier({ severity_score: 6, event: 'test' }, config);
    expect(result).not.toBeNull();
    expect(result?.classification).toBe('high');
    expect(result?.escalate).toBe(true);
  });

  it('drops report below threshold', () => {
    const result = runSeverityClassifier({ severity_score: 2, event: 'test' }, config);
    expect(result).toBeNull();
  });

  it('returns low classification for score above drop_below but no level match', () => {
    const result = runSeverityClassifier({ severity_score: 4, event: 'test' }, config);
    expect(result).not.toBeNull();
    expect(result?.classification).toBe('low');
    expect(result?.escalate).toBe(false);
  });
});

// ─────────────────────────────────────────
// field_normalizer
// ─────────────────────────────────────────
describe('field_normalizer', () => {
  const config = {
    normalize: {
      location: ['area', 'zone', 'region'],
      contact: ['submitted_by', 'reporter'],
    },
    remove_nulls: true,
  };

  it('normalizes area to location', () => {
    const result = runFieldNormalizer({ area: 'North Gaza', event: 'test' }, config);
    expect(result?.location).toBe('North Gaza');
    expect(result?.area).toBeUndefined();
  });

  it('normalizes submitted_by to contact', () => {
    const result = runFieldNormalizer({ submitted_by: 'UNRWA Officer', event: 'test' }, config);
    expect(result?.contact).toBe('UNRWA Officer');
    expect(result?.submitted_by).toBeUndefined();
  });

  it('removes null fields when remove_nulls is true', () => {
    const result = runFieldNormalizer({ event: 'test', notes: null, area: 'Gaza' }, config);
    expect(result?.notes).toBeUndefined();
    expect(result?.location).toBe('Gaza');
  });

  it('keeps fields not in normalize map', () => {
    const result = runFieldNormalizer({ event: 'test', severity_score: 7 }, config);
    expect(result?.severity_score).toBe(7);
    expect(result?.event).toBe('test');
  });
});

// ─────────────────────────────────────────
// keyword_alert
// ─────────────────────────────────────────
describe('keyword_alert', () => {
  const config = {
    scan_field: 'description',
    critical_keywords: ['airstrike', 'casualty', 'evacuation'],
    flag_field: 'requires_immediate_action',
    drop_if_no_match: false,
  };

  it('flags report with matching keywords', () => {
    const result = runKeywordAlert(
      {
        event: 'test',
        description: 'Airstrike hit near hospital, casualty reported',
      },
      config
    );
    expect(result?.requires_immediate_action).toBe(true);
    expect(result?.matched_keywords).toContain('airstrike');
    expect(result?.matched_keywords).toContain('casualty');
  });

  it('flags false when no keywords match', () => {
    const result = runKeywordAlert(
      { event: 'test', description: 'Routine daily check completed' },
      config
    );
    expect(result?.requires_immediate_action).toBe(false);
    expect(result?.matched_keywords).toHaveLength(0);
  });

  it('drops report when drop_if_no_match is true and no keywords found', () => {
    const result = runKeywordAlert(
      { event: 'test', description: 'Routine check' },
      { ...config, drop_if_no_match: true }
    );
    expect(result).toBeNull();
  });

  it('delivers when drop_if_no_match is true but keywords match', () => {
    const result = runKeywordAlert(
      { event: 'test', description: 'evacuation needed immediately' },
      { ...config, drop_if_no_match: true }
    );
    expect(result).not.toBeNull();
    expect(result?.requires_immediate_action).toBe(true);
  });
});

// ─────────────────────────────────────────
// response_enricher
// ─────────────────────────────────────────
describe('response_enricher', () => {
  const config = {
    addTimestamp: true,
    addPipelineId: true,
    addField: { system: 'humanitarian-aid', region: 'Gaza' },
    priorityMap: {
      critical: 'P1 - Respond within 1 hour',
      high: 'P2 - Respond within 4 hours',
    },
    prioritySource: 'classification',
  };

  const pipelineId = 'test-pipeline-id';

  it('adds timestamp to payload', () => {
    const result = runResponseEnricher({ event: 'test' }, config, pipelineId);
    expect(result?.processedAt).toBeDefined();
  });

  it('adds pipelineId to payload', () => {
    const result = runResponseEnricher({ event: 'test' }, config, pipelineId);
    expect(result?.pipelineId).toBe('test-pipeline-id');
  });

  it('adds custom fields from addField config', () => {
    const result = runResponseEnricher({ event: 'test' }, config, pipelineId);
    expect(result?.system).toBe('humanitarian-aid');
    expect(result?.region).toBe('Gaza');
  });

  it('maps responseWindow from classification', () => {
    const result = runResponseEnricher(
      { event: 'test', classification: 'critical' },
      config,
      pipelineId
    );
    expect(result?.responseWindow).toBe('P1 - Respond within 1 hour');
  });

  it('skips responseWindow if classification not in map', () => {
    const result = runResponseEnricher(
      { event: 'test', classification: 'unknown' },
      config,
      pipelineId
    );
    expect(result?.responseWindow).toBeUndefined();
  });
});
