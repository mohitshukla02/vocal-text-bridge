// Local cost estimates from Sarvam's published rates (docs.sarvam.ai/api-reference-docs/pricing).
// These are estimates, not a billing pull — Sarvam has no API for actual usage/invoice data.
const STT_RATE_PER_HOUR_INR = 45; // speech-to-text batch API with diarization
const CHAT_INPUT_RATE_PER_M_TOKENS_INR = 29.28; // sarvam-105b input tokens
const CHAT_OUTPUT_RATE_PER_M_TOKENS_INR = 73.2; // sarvam-105b output tokens

function sttCostINR(durationSeconds) {
  return (durationSeconds / 3600) * STT_RATE_PER_HOUR_INR;
}

function renameCostINR(usage) {
  if (!usage) return 0;
  const promptTokens = usage.prompt_tokens || 0;
  const completionTokens = usage.completion_tokens || 0;
  return (
    (promptTokens * CHAT_INPUT_RATE_PER_M_TOKENS_INR) / 1_000_000 +
    (completionTokens * CHAT_OUTPUT_RATE_PER_M_TOKENS_INR) / 1_000_000
  );
}

module.exports = { sttCostINR, renameCostINR };
