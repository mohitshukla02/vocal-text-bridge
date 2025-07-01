
import React from 'react';
import { useTranscription } from '@/hooks/useTranscription';
import TranscriptionHeader from './TranscriptionHeader';
import FileUploadSection from './FileUploadSection';
import AudioPlayerSection from './AudioPlayerSection';
import TranscriptionControls from './TranscriptionControls';
import TranscriptDisplay from './TranscriptDisplay';

const TranscriptionApp = () => {
  const { state, handleFileSelect, handleTranscribe, handleCopyTranscript } = useTranscription();

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <TranscriptionHeader />
      
      <FileUploadSection onFileSelect={handleFileSelect} />
      
      <AudioPlayerSection
        audioUrl={state.audioUrl}
        fileName={state.file?.name || 'Audio file'}
      />
      
      <TranscriptionControls
        onTranscribe={handleTranscribe}
        isTranscribing={state.isTranscribing}
        hasFile={!!state.file}
      />
      
      {state.transcript && (
        <TranscriptDisplay
          transcript={state.transcript}
          onCopy={handleCopyTranscript}
        />
      )}
    </div>
  );
};

export default TranscriptionApp;
