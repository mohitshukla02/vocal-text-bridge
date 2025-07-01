# Voice Transcription App

**Important:**
- You must create a `.env` file in the `server` directory with your OpenAI API key:
  ```
  OPENAI_API_KEY=your_actual_api_key_here
  ```
- Start the backend server (`cd server && npm install && npm run dev`) and the frontend (`npm install && npm run dev`) in separate terminals.
- The frontend will proxy `/api` requests to the backend automatically during development.

A beautiful single-page application that converts .m4a voice notes into clean, readable text using OpenAI's Whisper API.

## Features

- 🎵 Drag-and-drop .m4a file upload
- 🔊 Audio playback with progress controls
- 🤖 AI-powered transcription using OpenAI Whisper
- 📋 One-click transcript copying
- 🎨 Modern, warm UI with Tailwind CSS
- 📱 Fully responsive design

## Setup Instructions

### 1. Install Dependencies

**Frontend:**
```bash
npm install
```

**Backend:**
```bash
cd server
npm install
```

### 2. Environment Configuration

1. Copy `.env.example` to `.env` in the root directory
2. Add your OpenAI API key:
   ```
   OPENAI_API_KEY=your_actual_api_key_here
   ```

### 3. Development

**Start the backend server:**
```bash
cd server
npm run dev
```

**Start the frontend (in a new terminal):**
```bash
npm run dev
```

The app will be available at `http://localhost:8080`
The API server runs on `http://localhost:3001`

### 4. Production Deployment

**Build the frontend:**
```bash
npm run build
```

**Start the production server:**
```bash
cd server
npm start
```

## API Configuration

The app needs an OpenAI API key to function. You can get one from [OpenAI's platform](https://platform.openai.com/api-keys).

**Important:** Never commit your actual API key to version control. Use environment variables or a secure secrets management system.

## Supported File Formats

- .m4a audio files (most common voice note format)
- Maximum file size: 25MB (OpenAI's limit)

## Technical Stack

- **Frontend:** React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Node.js, Express, Multer
- **AI:** OpenAI Whisper API
- **Build Tool:** Vite

## Future Enhancements

- Supabase integration for file storage and user authentication
- Support for additional audio formats
- Batch transcription processing
- Transcript editing and saving
- Multi-language detection and support
