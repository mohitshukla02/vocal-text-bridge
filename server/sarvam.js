const fetch = require('node-fetch');

/**
 * Call Sarvam AI's chat completions API (non-streaming).
 *
 * Sarvam's endpoint is OpenAI-compatible chat completions.
 * Config via env:
 *   SARVAM_API_KEY (required)
 *   SARVAM_MODEL   (optional, default sarvam-105b)
 *   SARVAM_HOST    (optional, default https://api.sarvam.ai)
 */
async function callSarvamChat({
  systemPrompt,
  userPrompt,
  temperature = 0.2,
  maxTokens = 2048,
  model,
  responseFormat,
}) {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    const err = new Error('Sarvam API key not configured (set SARVAM_API_KEY)');
    err.code = 'NO_SARVAM_KEY';
    throw err;
  }

  const host = process.env.SARVAM_HOST || 'https://api.sarvam.ai';
  const resolvedModel = model || process.env.SARVAM_MODEL || 'sarvam-105b';

  const body = {
    model: resolvedModel,
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  };
  if (responseFormat === 'json') {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(`${host}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    const err = new Error(`Sarvam HTTP ${res.status}: ${errBody.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content?.trim() || '';
  return { content, usage: data.usage || null, model: resolvedModel };
}

module.exports = { callSarvamChat };
