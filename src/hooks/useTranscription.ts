
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface TranscriptionState {
  file: File | null;
  audioUrl: string | null;
  transcript: string | null;
  isTranscribing: boolean;
  isPlaying: boolean;
}

export const useTranscription = () => {
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

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      if (!response.ok) {
        // Handle different error statuses
        if (response.status === 404) {
          throw new Error('Transcription service not available. Please make sure the server is running.');
        }
        
        // Try to get error message from response
        let errorMessage = 'Transcription failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (jsonError) {
          // If response is not JSON, use status text
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        
        throw new Error(errorMessage);
      }

      // Check if response has content
      const responseText = await response.text();
      console.log('Raw response:', responseText);
      
      if (!responseText) {
        throw new Error('Empty response from server');
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', responseText);
        throw new Error('Invalid response format from server');
      }

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

  return {
    state,
    handleFileSelect,
    handleTranscribe,
    handleCopyTranscript,
  };
};
