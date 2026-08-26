#!/usr/bin/env node
/**
 * Side-by-side diarization comparison: AssemblyAI vs Sarvam (saaras:v3 batch API).
 *
 * Usage:
 *   node server/compare-diarization.js <path-to-audio.m4a> [numSpeakers]
 *
 * Sends the same audio file to both providers, waits for both to finish, and
 * prints/saves a side-by-side transcript so you can judge diarization quality
 * yourself. Assumes Hindi-only audio (language_code hi / hi-IN); edit LANGUAGE
 * below if that changes.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const LANGUAGE_ASSEMBLYAI = 'hi';
const LANGUAGE_SARVAM = 'hi-IN';

const audioPath = process.argv[2];
const numSpeakers = process.argv[3] ? parseInt(process.argv[3], 10) : undefined;

if (!audioPath) {
  console.error('Usage: node server/compare-diarization.js <path-to-audio.m4a> [numSpeakers]');
  process.exit(1);
}
if (!fs.existsSync(audioPath)) {
  console.error(`File not found: ${audioPath}`);
  process.exit(1);
}

const fileBuffer = fs.readFileSync(audioPath);
const fileName = path.basename(audioPath);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// AssemblyAI
// ---------------------------------------------------------------------------
async function transcribeWithAssemblyAI() {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) throw new Error('ASSEMBLYAI_API_KEY not configured');

  console.log('[AssemblyAI] Uploading audio...');
  const uploadRes = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST',
    headers: { authorization: apiKey, 'transfer-encoding': 'chunked' },
    body: fileBuffer,
  });
  if (!uploadRes.ok) throw new Error(`AssemblyAI upload failed: ${uploadRes.status} ${await uploadRes.text()}`);
  const { upload_url } = await uploadRes.json();

  console.log('[AssemblyAI] Starting transcription...');
  const transcriptRes = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: { authorization: apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      audio_url: upload_url,
      speaker_labels: true,
      language_code: LANGUAGE_ASSEMBLYAI,
      ...(numSpeakers ? { speakers_expected: numSpeakers } : {}),
    }),
  });
  if (!transcriptRes.ok) throw new Error(`AssemblyAI transcript request failed: ${transcriptRes.status} ${await transcriptRes.text()}`);
  const { id: transcriptId } = await transcriptRes.json();

  const pollUrl = `https://api.assemblyai.com/v2/transcript/${transcriptId}`;
  for (let i = 0; i < 600; i++) {
    await sleep(3000);
    const pollRes = await fetch(pollUrl, { headers: { authorization: apiKey } });
    if (!pollRes.ok) throw new Error(`AssemblyAI polling failed: ${pollRes.status} ${await pollRes.text()}`);
    const result = await pollRes.json();
    if (result.status === 'completed') {
      console.log('[AssemblyAI] Done.');
      return {
        provider: 'AssemblyAI',
        text: result.text,
        utterances: (result.utterances || []).map((u) => ({
          speaker: String(u.speaker),
          text: u.text,
          start: u.start / 1000,
          end: u.end / 1000,
        })),
      };
    }
    if (result.status === 'failed') throw new Error(`AssemblyAI transcription failed: ${result.error}`);
    console.log(`[AssemblyAI] status=${result.status}...`);
  }
  throw new Error('AssemblyAI transcription timed out');
}

// ---------------------------------------------------------------------------
// Sarvam (saaras:v3 batch API)
// ---------------------------------------------------------------------------
async function sarvamRequest(pathSuffix, body) {
  const apiKey = process.env.SARVAM_API_KEY;
  const host = process.env.SARVAM_HOST || 'https://api.sarvam.ai';
  const res = await fetch(`${host}${pathSuffix}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-subscription-key': apiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Sarvam ${pathSuffix} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function transcribeWithSarvam() {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) throw new Error('SARVAM_API_KEY not configured');
  const host = process.env.SARVAM_HOST || 'https://api.sarvam.ai';

  console.log('[Sarvam] Initiating job...');
  const job = await sarvamRequest('/speech-to-text/job/v1', {
    job_parameters: {
      model: 'saaras:v3',
      mode: 'transcribe',
      language_code: LANGUAGE_SARVAM,
      with_diarization: true,
      num_speakers: numSpeakers || null,
    },
  });
  const jobId = job.job_id;

  console.log('[Sarvam] Requesting upload URL...');
  const uploadInfo = await sarvamRequest('/speech-to-text/job/v1/upload-files', {
    job_id: jobId,
    files: [fileName],
  });
  const uploadUrl = uploadInfo.upload_urls?.[fileName]?.file_url;
  if (!uploadUrl) throw new Error('Sarvam did not return an upload URL for the file');

  console.log('[Sarvam] Uploading audio bytes...');
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'x-ms-blob-type': 'BlockBlob',
      'x-ms-blob-content-type': 'audio/mp4',
      'Content-Type': 'audio/mp4',
      'Content-Length': String(fileBuffer.length),
    },
    body: fileBuffer,
  });
  if (!putRes.ok) throw new Error(`Sarvam blob upload failed: ${putRes.status} ${await putRes.text()}`);

  console.log('[Sarvam] Starting job...');
  await sarvamRequest(`/speech-to-text/job/v1/${jobId}/start`, {});

  const statusUrl = `${host}/speech-to-text/job/v1/${jobId}/status`;
  let status;
  for (let i = 0; i < 200; i++) {
    await sleep(3000);
    const statusRes = await fetch(statusUrl, { headers: { 'api-subscription-key': apiKey } });
    if (!statusRes.ok) throw new Error(`Sarvam status check failed: ${statusRes.status} ${await statusRes.text()}`);
    status = await statusRes.json();
    if (status.job_state === 'Completed' || status.job_state === 'PartiallyCompleted') break;
    if (status.job_state === 'Failed') throw new Error(`Sarvam job failed: ${status.error_message}`);
    console.log(`[Sarvam] job_state=${status.job_state}...`);
  }
  if (!status || (status.job_state !== 'Completed' && status.job_state !== 'PartiallyCompleted')) {
    throw new Error('Sarvam job timed out');
  }

  if (process.env.DEBUG_SARVAM) {
    console.log('[Sarvam] Final status:', JSON.stringify(status, null, 2));
  }

  const outputFile = status.job_details?.[0]?.outputs?.[0]?.file_name;
  if (!outputFile) throw new Error('Sarvam job completed but produced no output file');

  console.log('[Sarvam] Downloading result...');
  const downloadInfo = await sarvamRequest('/speech-to-text/job/v1/download-files', {
    job_id: jobId,
    files: [outputFile],
  });
  const downloadUrl = downloadInfo.download_urls?.[outputFile]?.file_url;
  if (!downloadUrl) throw new Error('Sarvam did not return a download URL for the output');

  const resultRes = await fetch(downloadUrl);
  if (!resultRes.ok) throw new Error(`Sarvam result download failed: ${resultRes.status}`);
  const result = await resultRes.json();

  if (process.env.DEBUG_SARVAM) {
    fs.writeFileSync(path.join(__dirname, 'comparisons', 'sarvam-raw-debug.json'), JSON.stringify(result, null, 2));
    console.log('[Sarvam] Raw result keys:', Object.keys(result));
  }

  console.log('[Sarvam] Done.');
  const entries = result.diarized_transcript?.entries || [];
  return {
    provider: 'Sarvam',
    text: result.transcript,
    utterances: entries.map((u) => ({
      speaker: String(u.speaker_id),
      text: u.transcript,
      start: u.start_time_seconds,
      end: u.end_time_seconds,
    })),
  };
}

// ---------------------------------------------------------------------------
// Comparison output
// ---------------------------------------------------------------------------
function summarize(result) {
  if (!result) return null;
  const speakers = [...new Set(result.utterances.map((u) => u.speaker))];
  return {
    provider: result.provider,
    speakerCount: speakers.length,
    speakers,
    utteranceCount: result.utterances.length,
    totalWords: (result.text || '').split(/\s+/).filter(Boolean).length,
  };
}

function formatTranscript(result) {
  if (!result) return '(failed — see error above)';
  return result.utterances
    .map((u) => `[${u.start.toFixed(1)}s-${u.end.toFixed(1)}s] Speaker ${u.speaker}: ${u.text}`)
    .join('\n');
}

async function main() {
  console.log(`Comparing diarization for: ${fileName}\n`);

  const [assemblyResult, sarvamResult] = await Promise.all([
    transcribeWithAssemblyAI().catch((e) => {
      console.error('[AssemblyAI] ERROR:', e.message);
      return null;
    }),
    transcribeWithSarvam().catch((e) => {
      console.error('[Sarvam] ERROR:', e.message);
      return null;
    }),
  ]);

  const outDir = path.join(__dirname, 'comparisons');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = path.join(outDir, `${stamp}-${fileName.replace(/\.[^.]+$/, '')}.md`);

  const summaryA = summarize(assemblyResult);
  const summaryS = summarize(sarvamResult);

  const report = [
    `# Diarization comparison: ${fileName}`,
    '',
    '## Summary',
    '',
    '| | AssemblyAI | Sarvam |',
    '|---|---|---|',
    `| Speakers detected | ${summaryA ? summaryA.speakerCount : 'FAILED'} | ${summaryS ? summaryS.speakerCount : 'FAILED'} |`,
    `| Utterances | ${summaryA ? summaryA.utteranceCount : '-'} | ${summaryS ? summaryS.utteranceCount : '-'} |`,
    `| Word count | ${summaryA ? summaryA.totalWords : '-'} | ${summaryS ? summaryS.totalWords : '-'} |`,
    '',
    '## AssemblyAI transcript',
    '```',
    formatTranscript(assemblyResult),
    '```',
    '',
    '## Sarvam transcript',
    '```',
    formatTranscript(sarvamResult),
    '```',
  ].join('\n');

  fs.writeFileSync(outFile, report, 'utf8');

  console.log('\n' + '='.repeat(80));
  console.log(report);
  console.log('='.repeat(80));
  console.log(`\nSaved to: ${outFile}`);
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
