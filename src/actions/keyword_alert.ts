interface KeywordConfig {
  scan_field: string;
  critical_keywords: string[];
  flag_field?: string;
  drop_if_no_match?: boolean;
}

export function runKeywordAlert(
  payload: Record<string, unknown>,
  config: Record<string, unknown>
): Record<string, unknown> | null {
  const cfg = config as unknown as KeywordConfig;
  const textToScan = String(payload[cfg.scan_field] ?? '').toLowerCase();
  const flagField = cfg.flag_field ?? 'keyword_alert_triggered';

  const matchedKeywords = cfg.critical_keywords.filter((keyword) =>
    textToScan.includes(keyword.toLowerCase())
  );

  const hasMatch = matchedKeywords.length > 0;

  // if no match and drop_if_no_match is true
  // null = worker will not deliver to subscribers
  if (!hasMatch && cfg.drop_if_no_match) {
    return null;
  }

  return {
    ...payload,
    [flagField]: hasMatch,
    matched_keywords: matchedKeywords,
    keyword_scan_field: cfg.scan_field,
  };
}
