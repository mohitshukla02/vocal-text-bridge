
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Upload, Play, Pause, Copy, FileAudio, Loader } from 'lucide-react';
import FileDropzone from './FileDropzone';
import AudioPlayer from './AudioPlayer';
import TranscriptDisplay from './TranscriptDisplay';

interface TranscriptionState {
  file: File | null;
  audioUrl: string | null;
  transcript: string | null;
  isTranscribing: boolean;
  isPlaying: boolean;
}

const TranscriptionApp = () => {
  const { toast } = useToast();
  const [state, setState] = useState<TranscriptionState>({
    file: null,
    audioUrl: null,
    transcript: null,
    isTranscribing: false,
    isPlaying: false,
  });

  const handleFileSelect = (file: File) => {
    console.log('File selected:', file.name, file.type, file.size);
    
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.m4a') && file.type !== 'audio/mp4') {
      toast({
        title: "Invalid file type",
        description: "Please select an .m4a audio file.",
        variant: "destructive",
      });
      return;
    }

    // Create audio URL for playback
    const audioUrl = URL.createObjectURL(file);
    
    setState(prev => ({
      ...prev,
      file,
      audioUrl,
      transcript: null, // Reset transcript when new file is selected
    }));

    toast({
      title: "File uploaded",
      description: `${file.name} is ready for transcription.`,
    });
  };

  const handleTranscribe = async () => {
    if (!state.file) {
      toast({
        title: "No file selected",
        description: "Please upload an audio file first.",
        variant: "destructive",
      });
      return;
    }

    setState(prev => ({ ...prev, isTranscribing: true }));

    try {
      console.log('Starting transcription for:', state.file.name);
      
      const formData = new FormData();
      formData.append('audio', state.file);

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Transcription failed');
      }

      const data = await response.json();
      console.log('Transcription completed:', data.text);

      setState(prev => ({
        ...prev,
        transcript: data.text,
        isTranscribing: false,
      }));

      toast({
        title: "Transcription complete",
        description: "Your audio has been successfully transcribed.",
      });
    } catch (error) {
      console.error('Transcription error:', error);
      setState(prev => ({ ...prev, isTranscribing: false }));
      
      toast({
        title: "Transcription failed",
        description: error instanceof Error ? error.message : "An error occurred during transcription.",
        variant: "destructive",
      });
    }
  };

  const handleCopyTranscript = async () => {
    if (!state.transcript) return;

    try {
      await navigator.clipboard.writeText(state.transcript);
      toast({
        title: "Copied to clipboard",
        description: "Transcript has been copied to your clipboard.",
      });
    } catch (error) {
      console.error('Copy failed:', error);
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
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

      {/* File Upload Section */}
      <Card className="mb-6 border-amber-200 shadow-lg">
        <CardContent className="p-6">
          <FileDropzone onFileSelect={handleFileSelect} />
        </CardContent>
      </Card>

      {/* Audio Player Section */}
      {state.audioUrl && (
        <Card className="mb-6 border-amber-200 shadow-lg">
          <CardContent className="p-6">
            <AudioPlayer
              audioUrl={state.audioUrl}
              fileName={state.file?.name || 'Audio file'}
            />
          </CardContent>
        </Card>
      )}

      {/* Transcription Controls */}
      {state.file && (
        <Card className="mb-6 border-amber-200 shadow-lg">
          <CardContent className="p-6 text-center">
            <Button
              onClick={handleTranscribe}
              disabled={state.isTranscribing}
              size="lg"
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold px-8 py-3 rounded-xl shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105"
            >
              {state.isTranscribing ? (
                <>
                  <Loader className="w-5 h-5 mr-2 animate-spin" />
                  Transcribing...
                </>
              ) : (
                <>
                  <FileAudio className="w-5 h-5 mr-2" />
                  Transcribe Audio
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Transcript Display */}
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
