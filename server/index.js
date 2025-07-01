
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const FormData = require('form-data');
const fetch = require('node-fetch');
const path = require('path');

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

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error('OpenAI API key not found in environment variables');
      return res.status(500).json({ error: 'Server configuration error: Missing OpenAI API key' });
    }

    console.log('Processing file:', req.file.originalname, 'Size:', req.file.size);

    // Create form data for OpenAI API
    const formData = new FormData();
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });
    formData.append('model', 'whisper-1');
    formData.append('language', 'en'); // You can make this configurable
    formData.append('response_format', 'text');

    console.log('Sending request to OpenAI Whisper API...');

    // Call OpenAI Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      
      if (response.status === 401) {
        return res.status(500).json({ error: 'Invalid OpenAI API key' });
      } else if (response.status === 413) {
        return res.status(400).json({ error: 'Audio file too large (max 25MB)' });
      } else {
        return res.status(500).json({ 
          error: `Transcription failed: ${response.status} ${response.statusText}` 
        });
      }
    }

    const transcriptionText = await response.text();
    console.log('Transcription completed successfully');

    res.json({ 
      text: transcriptionText.trim(),
      filename: req.file.originalname 
    });

  } catch (error) {
    console.error('Transcription error:', error);
    
    if (error.message.includes('Only .m4a files are allowed')) {
      return res.status(400).json({ error: 'Only .m4a audio files are supported' });
    }
    
    res.status(500).json({ 
      error: 'Internal server error during transcription',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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
  console.log(`OpenAI API Key configured: ${!!process.env.OPENAI_API_KEY}`);
});
