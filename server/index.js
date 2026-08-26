// In the packaged desktop app, Electron points this at userData/.env (the
// project's .env isn't shipped or writable there). Falls back to the
// project-root .env for dev/manual `node server/index.js` runs.
require('dotenv').config({
  path: process.env.ECHOTRON_ENV_PATH || require('path').join(__dirname, '..', '.env'),
});

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const NodeCache = require('node-cache');
const { callSarvamChat } = require('./sarvam');
const { transcribeWithSarvam, MIME_BY_EXT } = require('./sarvam-stt');
const { withRetry } = require('./retry');
const store = require('./store');
const { sttCostINR, renameCostINR } = require('./cost');

const ACCEPTED_EXTENSIONS = Object.keys(MIME_BY_EXT); // .m4a .mp4 .mp3 .wav .ogg .opus

const app = express();
const port = process.env.PORT || 5075;

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB (Sarvam batch API accepts up to 2-hour recordings)
  },
  fileFilter: (req, file, cb) => {
    const name = file.originalname.toLowerCase();
    if (ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type. Accepted: ${ACCEPTED_EXTENSIONS.join(', ')}`));
    }
  },
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, '../dist')));

const speakerCache = new NodeCache({ stdTTL: 60 * 60 * 24 }); // 24h cache

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Transcription API is running' });
});

// Transcription endpoint
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    console.log('Transcription request received');
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    if (!process.env.SARVAM_API_KEY) {
      console.error('Sarvam API key not found in environment variables');
      return res.status(500).json({ error: 'Server configuration error: Missing Sarvam API key' });
    }

    console.log('Transcribing via Sarvam (saaras:v3, diarization enabled)...');
    const { text, utterances, durationSeconds } = await withRetry(
      () => transcribeWithSarvam({ buffer: req.file.buffer, fileName: req.file.originalname }),
      { attempts: 4, delayMs: 2000, onRetry: (err, n, delay) => console.warn(`Transcription attempt ${n} failed, retrying in ${delay}ms: ${err.message}`) }
    );
    console.log(`Transcription complete. ${utterances.length} utterances.`);

    res.json({
      utterances,
      text,
      durationSeconds,
      filename: req.file.originalname,
      sttCostINR: sttCostINR(durationSeconds),
    });
  } catch (error) {
    console.error('Transcription error:', error);
    if (error.message && error.message.includes('Unsupported file type')) {
      return res.status(400).json({ error: error.message });
    }
    // Personal single-user desktop app — always surface the real error so
    // failures are diagnosable from the UI alone, not just server logs.
    res.status(500).json({
      error: 'Transcription failed',
      details: error.message,
    });
  }
});

// Speaker renaming endpoint
app.post('/api/rename-speakers', async (req, res) => {
  try {
    if (!process.env.SARVAM_API_KEY) {
      return res.status(500).json({ error: 'Sarvam API key not configured' });
    }
    const { utterances } = req.body;
    if (!Array.isArray(utterances) || utterances.length === 0) {
      return res.status(400).json({ error: 'No utterances provided' });
    }

    // Collapse repetitive/filler utterances for prompt efficiency
    function cleanUtterances(utterances) {
      const fillers = [
        'um', 'uh', 'hmm', 'hmmm', 'haan', 'huh', 'hmm.', 'hmmm.', 'hmm..', 'hmmm..',
        'hmm...', 'hmmm...', 'hmm?', 'hmmm?', 'hmm!', 'hmmm!', 'hmm,', 'hmmm,',
        'like', 'you know', 'matlab', 'basically', 'actually', 'so', 'toh', 'accha', 'okay', 'ok', 'hmm hmm', 'hmmm hmmm', 'hmm hmm hmm', 'hmmm hmmm hmmm'
      ];
      return utterances.filter(u => {
        const t = u.text.trim().toLowerCase();
        if (t.length < 2) return false;
        if (fillers.includes(t)) return false;
        return true;
      });
    }

    // Build speaker-labeled transcript for prompt
    function buildSpeakerTranscript(utterances) {
      return utterances.map(u => `Speaker ${u.speaker}: ${u.text}`).join('\n');
    }

    // Use upstream speaker metadata if available
    function buildSpeakerContext(utterances) {
      // If any utterance has a 'speaker_label' or 'role', add as context
      const meta = utterances.reduce((acc, u) => {
        if (u.speaker_label && !acc[u.speaker]) acc[u.speaker] = u.speaker_label;
        if (u.role && !acc[u.speaker]) acc[u.speaker] = u.role;
        return acc;
      }, {});
      if (Object.keys(meta).length === 0) return '';
      return '\n\nSpeaker metadata (if any):\n' + Object.entries(meta).map(([spk, label]) => `Speaker ${spk}: ${label}`).join(', ');
    }

    // Build the speaker-labeled transcript. Names are usually introduced early,
    // so if a transcript is enormous we keep the FIRST chunk (where intros live).
    const cleanedUtterances = cleanUtterances(utterances);
    const speakerContext = buildSpeakerContext(utterances);
    let speakerTranscript = buildSpeakerTranscript(cleanedUtterances);
    const MAX_PROMPT_CHARS = 120000; // generous; ~1hr of speech fits well under this
    if (speakerTranscript.length > MAX_PROMPT_CHARS) {
      speakerTranscript = speakerTranscript.slice(0, MAX_PROMPT_CHARS);
    }

    // Distinct speaker labels we need names for (e.g. ["A", "B"])
    const speakerLabels = [...new Set(utterances.map(u => String(u.speaker)))];

    // Ask Sarvam ONLY for a small label->name map (not the whole transcript).
    // This avoids output truncation and keeps every utterance intact client-side.
    const prompt =
      'You are an expert at analyzing meeting and voice-note transcripts.\n\n' +
      'The transcript below uses generic speaker labels (Speaker A, Speaker B, ...). ' +
      'For EACH label, infer the best short name or role from the content.\n\n' +
      'Rules:\n' +
      '- Use a real name if one is clearly mentioned for that speaker (e.g., Ravi, Priya).\n' +
      '- Otherwise use a concise role (e.g., Manager, Doctor, Interviewer, Client).\n' +
      '- If you truly cannot tell, reuse the original label (e.g., "Speaker A").\n' +
      '- Keep each value short — a name or role, optionally "Name (Role)". Do NOT return transcript text.\n' +
      '- Language may be English, Hindi, or a mix.\n\n' +
      'Return ONLY a JSON object mapping each speaker label to its name, using these exact keys: ' +
      JSON.stringify(speakerLabels) + '.\n' +
      'Example: {"A": "Ravi (Sales)", "B": "Priya"}' +
      speakerContext + '\n\nTranscript:\n' + speakerTranscript;

    // Caching: hash the prompt
    const cacheKey = require('crypto').createHash('sha256').update(prompt).digest('hex');
    const cachedNames = speakerCache.get(cacheKey);
    if (cachedNames) {
      return res.json({ names: cachedNames, cached: true, renameCostINR: 0 });
    }

    // Call Sarvam (OpenAI-compatible chat completions), JSON mode for a clean map
    let dsResult;
    try {
      dsResult = await withRetry(
        () =>
          callSarvamChat({
            systemPrompt: 'You map speaker labels to concise names/roles and reply with JSON only.',
            userPrompt: prompt,
            temperature: 0.2,
            maxTokens: 1024,
            responseFormat: 'json',
          }),
        { attempts: 4, delayMs: 2000, onRetry: (err, n, delay) => console.warn(`Rename attempt ${n} failed, retrying in ${delay}ms: ${err.message}`) }
      );
    } catch (e) {
      console.error('Sarvam API error:', e);
      return res.status(500).json({ error: 'Sarvam API failed', details: e?.message });
    }

    // Parse the JSON map defensively; keep only non-empty string values.
    let names = {};
    try {
      const parsed = JSON.parse(dsResult.content || '{}');
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string' && v.trim()) names[k] = v.trim();
      }
    } catch (e) {
      console.error('Failed to parse Sarvam name map:', dsResult.content);
      return res.status(502).json({ error: 'Could not parse speaker names from Sarvam', details: (dsResult.content || '').slice(0, 200) });
    }

    speakerCache.set(cacheKey, names);
    res.json({ names, cached: false, renameCostINR: renameCostINR(dsResult.usage) });
  } catch (error) {
    console.error('Speaker renaming error:', error);
    res.status(500).json({ error: 'Internal server error during speaker renaming', details: error.message });
  }
});

// History endpoints
app.get('/api/history', (req, res) => {
  res.json({ history: store.getHistory() });
});

app.delete('/api/history/:id', (req, res) => {
  store.deleteHistoryRecord(req.params.id);
  res.json({ ok: true });
});

// Settings endpoints
app.get('/api/settings', (req, res) => {
  res.json(store.getSettings());
});

app.post('/api/settings', (req, res) => {
  const { outputFolder } = req.body;
  if (typeof outputFolder !== 'string' && outputFolder !== null) {
    return res.status(400).json({ error: 'outputFolder must be a string or null' });
  }
  res.json(store.updateSettings({ outputFolder }));
});

// Cost summary, rolled up from stored history records
app.get('/api/cost-summary', (req, res) => {
  const history = store.getHistory();
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  let allTimeSTT = 0, allTimeRename = 0, monthSTT = 0, monthRename = 0;
  for (const r of history) {
    allTimeSTT += r.sttCostINR || 0;
    allTimeRename += r.renameCostINR || 0;
    if ((r.date || '').startsWith(monthKey)) {
      monthSTT += r.sttCostINR || 0;
      monthRename += r.renameCostINR || 0;
    }
  }

  res.json({
    allTimeTotalINR: allTimeSTT + allTimeRename,
    allTimeSTTINR: allTimeSTT,
    allTimeRenameINR: allTimeRename,
    monthTotalINR: monthSTT + monthRename,
    monthSTTINR: monthSTT,
    monthRenameINR: monthRename,
    recordCount: history.length,
  });
});

// Save a finished transcript to the configured output folder and log it to history.
// Idempotent per (originalFilename, date) — re-saving after editing speaker names
// overwrites the same file/record instead of duplicating it.
app.post('/api/finalize', (req, res) => {
  try {
    const { originalFilename, utterances, speakerNames, durationSeconds, sttCostINR: sttCost, renameCostINR: renameCost } = req.body;
    if (!originalFilename || !Array.isArray(utterances)) {
      return res.status(400).json({ error: 'originalFilename and utterances are required' });
    }

    const { outputFolder } = store.getSettings();
    if (!outputFolder) {
      return res.status(400).json({ error: 'NO_OUTPUT_FOLDER', message: 'Choose a transcripts folder in Settings first' });
    }

    const displayName = (speaker) => {
      const n = (speakerNames || {})[String(speaker)];
      return n && n.trim() ? n.trim() : `Speaker ${speaker}`;
    };
    const transcriptText = utterances.map((u) => `${displayName(u.speaker)}: ${u.text}`).join('\n\n');

    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const baseName = originalFilename.replace(/\.[^.]+$/, '').replace(/[<>:"/\\|?*]/g, '_');
    const savedFilename = `${date}_${baseName}.txt`;
    const savedPath = path.join(outputFolder, savedFilename);

    fs.mkdirSync(outputFolder, { recursive: true });
    fs.writeFileSync(savedPath, transcriptText, 'utf8');

    const record = {
      id: require('crypto').randomUUID(),
      date,
      originalFilename,
      savedFilename,
      savedPath,
      utterances,
      speakerNames: speakerNames || {},
      durationSeconds: durationSeconds || 0,
      sttCostINR: sttCost || 0,
      renameCostINR: renameCost || 0,
    };
    store.addHistoryRecord(record);

    res.json({ savedPath, record });
  } catch (error) {
    console.error('Finalize error:', error);
    res.status(500).json({ error: 'Failed to save transcript', details: error.message });
  }
});

// Catch all handler: send back React's index.html file for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large (max 500MB)' });
    }
  }
  
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`Transcription server running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Sarvam API Key configured: ${!!process.env.SARVAM_API_KEY}`);
  console.log(`Sarvam chat model: ${process.env.SARVAM_MODEL || 'sarvam-105b'}`);
  console.log(`Sarvam STT language: ${process.env.SARVAM_STT_LANGUAGE || 'hi-IN'}`);
});
