interface SeverityLevel {
  operator: 'gte' | 'gt' | 'lte' | 'lt' | 'eq';
  value: number;
}

interface ClassifierConfig {
  severity_field: string;
  levels?: {
    critical?: SeverityLevel;
    high?: SeverityLevel;
    low?: SeverityLevel;
  };
  drop_below?: number;
}

function checkOperator(actual: number, operator: string, value: number): boolean {
  if (operator === 'gte') return actual >= value;
  if (operator === 'gt') return actual > value;
  if (operator === 'lte') return actual <= value;
  if (operator === 'lt') return actual < value;
  if (operator === 'eq') return actual === value;
  return false;
}

export function runSeverityClassifier(
  payload: Record<string, unknown>,
  config: Record<string, unknown>
): Record<string, unknown> | null {
  const cfg = config as unknown as ClassifierConfig;
  const severityValue = payload[cfg.severity_field] as number;

  if (cfg.drop_below !== undefined && severityValue < cfg.drop_below) {
    return null;
  }

  // classify the report
  let classification = 'low';
  let escalate = false;

  if (cfg.levels) {
    if (
      cfg.levels.critical &&
      checkOperator(severityValue, cfg.levels.critical.operator, cfg.levels.critical.value)
    ) {
      classification = 'critical';
      escalate = true;
    } else if (
      cfg.levels.high &&
      checkOperator(severityValue, cfg.levels.high.operator, cfg.levels.high.value)
    ) {
      classification = 'high';
      escalate = true;
    } else {
      classification = 'low';
      escalate = false;
    }
  }

  return {
    ...payload,
    classification,
    escalate,
  };
}
