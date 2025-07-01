require('dotenv').config();

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const FormData = require('form-data');
const fetch = require('node-fetch');
const path = require('path');
const NodeCache = require('node-cache');
const { OpenAI } = require('openai');

const app = express();
const port = process.env.PORT || 3001;

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit (OpenAI's limit)
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'audio/mp4' || file.originalname.toLowerCase().endsWith('.m4a')) {
      cb(null, true);
    } else {
      cb(new Error('Only .m4a files are allowed'));
    }
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, '../dist')));

const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;
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

    const assemblyApiKey = process.env.ASSEMBLYAI_API_KEY;
    if (!assemblyApiKey) {
      console.error('AssemblyAI API key not found in environment variables');
      return res.status(500).json({ error: 'Server configuration error: Missing AssemblyAI API key' });
    }

    // 1. Upload audio file to AssemblyAI
    console.log('Uploading file to AssemblyAI...');
    const uploadRes = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'authorization': assemblyApiKey,
        'transfer-encoding': 'chunked',
      },
      body: req.file.buffer,
    });
    if (!uploadRes.ok) {
      const errorText = await uploadRes.text();
      console.error('AssemblyAI upload error:', uploadRes.status, errorText);
      return res.status(500).json({ error: 'Failed to upload audio to AssemblyAI' });
    }
    const uploadData = await uploadRes.json();
    const audio_url = uploadData.upload_url;
    console.log('Audio uploaded. URL:', audio_url);

    // 2. Start transcription with diarization
    const transcriptReqBody = {
      audio_url,
      speaker_labels: true,
      language_code: 'en', // You can make this configurable
    };
    console.log('Requesting transcription with diarization...');
    const transcriptRes = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'authorization': assemblyApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(transcriptReqBody),
    });
    if (!transcriptRes.ok) {
      const errorText = await transcriptRes.text();
      console.error('AssemblyAI transcript request error:', transcriptRes.status, errorText);
      return res.status(500).json({ error: 'Failed to start transcription with AssemblyAI' });
    }
    const transcriptData = await transcriptRes.json();
    const transcriptId = transcriptData.id;
    console.log('Transcription started. ID:', transcriptId);

    // 3. Poll for completion
    let completed = false;
    let transcriptResult = null;
    const pollingEndpoint = `https://api.assemblyai.com/v2/transcript/${transcriptId}`;
    for (let i = 0; i < 60; i++) { // Poll up to 60 times (about 2 minutes)
      await new Promise(r => setTimeout(r, 2000)); // Wait 2 seconds
      const pollRes = await fetch(pollingEndpoint, {
        headers: { 'authorization': assemblyApiKey },
      });
      if (!pollRes.ok) {
        const errorText = await pollRes.text();
        console.error('AssemblyAI polling error:', pollRes.status, errorText);
        return res.status(500).json({ error: 'Error polling AssemblyAI for transcript' });
      }
      transcriptResult = await pollRes.json();
      if (transcriptResult.status === 'completed') {
        completed = true;
        break;
      } else if (transcriptResult.status === 'failed') {
        console.error('Transcription failed:', transcriptResult.error);
        return res.status(500).json({ error: 'Transcription failed', details: transcriptResult.error });
      }
    }
    if (!completed) {
      return res.status(500).json({ error: 'Transcription timed out' });
    }

    // 4. Return speaker-labeled transcript
    // transcriptResult.words contains word-level diarization
    // transcriptResult.utterances contains speaker-labeled segments (if enabled)
    res.json({
      utterances: transcriptResult.utterances || [],
      text: transcriptResult.text,
      filename: req.file.originalname,
    });
  } catch (error) {
    console.error('Transcription error:', error);
    if (error.message && error.message.includes('Only .m4a files are allowed')) {
      return res.status(400).json({ error: 'Only .m4a audio files are supported' });
    }
    res.status(500).json({
      error: 'Internal server error during transcription',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Speaker renaming endpoint
app.post('/api/rename-speakers', async (req, res) => {
  try {
    if (!openai) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
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

    // Use AssemblyAI speaker metadata if available
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

    // Prepare prompt
    const cleanedUtterances = cleanUtterances(utterances);
    let speakerTranscript = buildSpeakerTranscript(cleanedUtterances);
    let speakerContext = buildSpeakerContext(utterances);
    let prompt = `You are an expert at analyzing meeting and voice note transcripts.\n\nGiven the following transcript with generic speaker labels (Speaker 1, Speaker 2, etc.), replace each speaker label with a more meaningful name or role, inferred from the content.\n\n- Use real names if mentioned (e.g., Ravi, Priya), or roles if obvious (e.g., Manager, Doctor, Interviewer, Client, etc.).\n- If unsure, use a descriptive role (e.g., "Male Voice", "Female Voice", "Unknown").\n- Keep the rest of the transcript unchanged.\n- Return only the cleaned transcript, with the new speaker names.\n- Language may be English, Hindi, or a mix.\n${speakerContext}\n\nTranscript:\n${speakerTranscript}`;

    // Trim prompt if too long (OpenAI limit: ~8k tokens for gpt-4o, ~4k for 3.5-turbo)
    const maxPromptLength = 12000; // chars, conservative for tokens
    if (prompt.length > maxPromptLength) {
      // Remove oldest utterances until under limit
      let keep = cleanedUtterances.slice(-60); // last 60 utterances
      speakerTranscript = buildSpeakerTranscript(keep);
      prompt = `You are an expert at analyzing meeting and voice note transcripts.\n\nGiven the following transcript with generic speaker labels (Speaker 1, Speaker 2, etc.), replace each speaker label with a more meaningful name or role, inferred from the content.\n\n- Use real names if mentioned (e.g., Ravi, Priya), or roles if obvious (e.g., Manager, Doctor, Interviewer, Client, etc.).\n- If unsure, use a descriptive role (e.g., "Male Voice", "Female Voice", "Unknown").\n- Keep the rest of the transcript unchanged.\n- Return only the cleaned transcript, with the new speaker names.\n- Language may be English, Hindi, or a mix.\n${speakerContext}\n\nTranscript:\n${speakerTranscript}`;
    }

    // Caching: hash the prompt
    const cacheKey = require('crypto').createHash('sha256').update(prompt).digest('hex');
    const cached = speakerCache.get(cacheKey);
    if (cached) {
      return res.json({ transcript: cached, cached: true });
    }

    // Call OpenAI GPT-4o, fallback to 3.5-turbo
    let gptResponse = null;
    let error = null;
    try {
      gptResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a helpful assistant for transcript cleanup.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 2048,
      });
    } catch (e) {
      error = e;
      // fallback to 3.5-turbo
      try {
        gptResponse = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are a helpful assistant for transcript cleanup.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2,
          max_tokens: 2048,
        });
      } catch (e2) {
        return res.status(500).json({ error: 'OpenAI GPT API failed', details: error?.message, fallbackError: e2?.message });
      }
    }
    const cleanedTranscript = gptResponse.choices?.[0]?.message?.content?.trim() || '';
    speakerCache.set(cacheKey, cleanedTranscript);
    res.json({ transcript: cleanedTranscript, cached: false });
  } catch (error) {
    console.error('Speaker renaming error:', error);
    res.status(500).json({ error: 'Internal server error during speaker renaming', details: error.message });
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
      return res.status(400).json({ error: 'File too large (max 25MB)' });
    }
  }
  
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`Transcription server running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`AssemblyAI API Key configured: ${!!process.env.ASSEMBLYAI_API_KEY}`);
});
