import { runFieldNormalizer } from "./field_normalizer";
import { runSeverityClassifier } from "./severity_classifier";
import { runKeywordAlert } from "./keyword_alert";
import { runResponseEnricher } from "./response_enricher";
import type { Pipeline } from "../types";

export function runAction(
  payload: Record<string, unknown>,
  pipeline: Pipeline,
): Record<string, unknown> | null {
  switch (pipeline.action_type) {
    case "field_normalizer":
      return runFieldNormalizer(payload, pipeline.action_config);

    case "severity_classifier":
      return runSeverityClassifier(payload, pipeline.action_config);

    case "keyword_alert":
      return runKeywordAlert(payload, pipeline.action_config);

    case "response_enricher":
      return runResponseEnricher(payload, pipeline.action_config, pipeline.id);

    default:
      throw new Error(`Unknown action type: ${pipeline.action_type}`);
  }
}
