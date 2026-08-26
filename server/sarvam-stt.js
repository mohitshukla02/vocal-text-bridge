const fetch = require('node-fetch');

/**
 * Transcribe + diarize audio via Sarvam's batch speech-to-text API (saaras:v3).
 *
 * This is an async batch job under the hood (initiate -> upload -> start ->
 * poll -> download), not a single request/response call. Verified against
 * Sarvam's docs and a real Hindi recording during evaluation against
 * AssemblyAI, which produced far coarser speaker splits on Hindi audio.
 *
 * Config via env:
 *   SARVAM_API_KEY      (required)
 *   SARVAM_HOST          (optional, default https://api.sarvam.ai)
 *   SARVAM_STT_LANGUAGE  (optional, default hi-IN)
 */
async function sarvamRequest(host, apiKey, pathSuffix, body) {
  const res = await fetch(`${host}${pathSuffix}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-subscription-key': apiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    const err = new Error(`Sarvam ${pathSuffix} failed: ${res.status} ${errBody.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Content-Type sent on the blob upload matters — Sarvam silently returns an
// empty transcript if it doesn't match the actual audio format.
const MIME_BY_EXT = {
  '.m4a': 'audio/mp4',
  '.mp4': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus',
};

function mimeTypeForFileName(fileName) {
  const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  return MIME_BY_EXT[ext] || 'application/octet-stream';
}

async function transcribeWithSarvam({ buffer, fileName, numSpeakers, mimeType }) {
  const resolvedMimeType = mimeType || mimeTypeForFileName(fileName);
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    const err = new Error('Sarvam API key not configured (set SARVAM_API_KEY)');
    err.code = 'NO_SARVAM_KEY';
    throw err;
  }
  const host = process.env.SARVAM_HOST || 'https://api.sarvam.ai';
  const languageCode = process.env.SARVAM_STT_LANGUAGE || 'hi-IN';

  const job = await sarvamRequest(host, apiKey, '/speech-to-text/job/v1', {
    job_parameters: {
      model: 'saaras:v3',
      mode: 'transcribe',
      language_code: languageCode,
      with_diarization: true,
      num_speakers: numSpeakers || null,
    },
  });
  const jobId = job.job_id;

  const uploadInfo = await sarvamRequest(host, apiKey, '/speech-to-text/job/v1/upload-files', {
    job_id: jobId,
    files: [fileName],
  });
  const uploadUrl = uploadInfo.upload_urls?.[fileName]?.file_url;
  if (!uploadUrl) throw new Error('Sarvam did not return an upload URL for the file');

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'x-ms-blob-type': 'BlockBlob',
      'x-ms-blob-content-type': resolvedMimeType,
      'Content-Type': resolvedMimeType,
      'Content-Length': String(buffer.length),
    },
    body: buffer,
  });
  if (!putRes.ok) throw new Error(`Sarvam blob upload failed: ${putRes.status} ${await putRes.text()}`);

  await sarvamRequest(host, apiKey, `/speech-to-text/job/v1/${jobId}/start`, {});

  const statusUrl = `${host}/speech-to-text/job/v1/${jobId}/status`;
  let status;
  for (let i = 0; i < 200; i++) { // ~10 minutes at 3s/poll
    await sleep(3000);
    const statusRes = await fetch(statusUrl, { headers: { 'api-subscription-key': apiKey } });
    if (!statusRes.ok) throw new Error(`Sarvam status check failed: ${statusRes.status} ${await statusRes.text()}`);
    status = await statusRes.json();
    if (status.job_state === 'Completed' || status.job_state === 'PartiallyCompleted') break;
    if (status.job_state === 'Failed') throw new Error(`Sarvam job failed: ${status.error_message}`);
  }
  if (!status || (status.job_state !== 'Completed' && status.job_state !== 'PartiallyCompleted')) {
    throw new Error('Sarvam transcription job timed out');
  }

  const outputFile = status.job_details?.[0]?.outputs?.[0]?.file_name;
  if (!outputFile) {
    const detailError = status.job_details?.[0]?.error_message;
    throw new Error(`Sarvam job completed but produced no output file${detailError ? `: ${detailError}` : ''}`);
  }

  const downloadInfo = await sarvamRequest(host, apiKey, '/speech-to-text/job/v1/download-files', {
    job_id: jobId,
    files: [outputFile],
  });
  const downloadUrl = downloadInfo.download_urls?.[outputFile]?.file_url;
  if (!downloadUrl) throw new Error('Sarvam did not return a download URL for the output');

  const resultRes = await fetch(downloadUrl);
  if (!resultRes.ok) throw new Error(`Sarvam result download failed: ${resultRes.status}`);
  const result = await resultRes.json();

  const entries = result.diarized_transcript?.entries || [];
  const durationSeconds = entries.reduce((max, u) => Math.max(max, u.end_time_seconds || 0), 0);
  return {
    text: result.transcript || '',
    durationSeconds,
    utterances: entries.map((u, i) => ({
      id: String(i),
      speaker: String(u.speaker_id),
      text: u.transcript,
      start: u.start_time_seconds,
      end: u.end_time_seconds,
    })),
  };
}

module.exports = { transcribeWithSarvam, MIME_BY_EXT };
