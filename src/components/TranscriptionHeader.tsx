
import React from 'react';
import { FileAudio } from 'lucide-react';

const TranscriptionHeader = () => {
  return (
    <div className="text-center mb-8">
      <div className="flex items-center justify-center gap-3 mb-4">
        <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl shadow-lg">
          <FileAudio className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
          Voice Transcription
        </h1>
      </div>
      <p className="text-gray-600 text-lg">
        Transform your voice notes into clean, readable text using AI
      </p>
    </div>
  );
};

export default TranscriptionHeader;
