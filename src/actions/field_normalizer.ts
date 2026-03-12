interface NormalizerConfig {
  normalize?: Record<string, string[]>;
  remove_nulls?: boolean;
}

export function runFieldNormalizer(
  payload: Record<string, unknown>,
  config: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...payload };
  const cfg = config as NormalizerConfig;

  if (cfg.normalize) {
    for (const [standardName, alternatives] of Object.entries(cfg.normalize)) {
      for (const alt of alternatives) {
        if (alt in result && !(standardName in result)) {
          result[standardName] = result[alt];
          delete result[alt];
          break;
        }
      }
    }
  }

  if (cfg.remove_nulls) {
    for (const key of Object.keys(result)) {
      if (result[key] === null || result[key] === undefined) {
        delete result[key];
      }
    }
  }

  return result;
}
