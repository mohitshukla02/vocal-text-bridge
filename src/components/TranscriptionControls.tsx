
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileAudio, Loader } from 'lucide-react';

interface TranscriptionControlsProps {
  onTranscribe: () => void;
  isTranscribing: boolean;
  hasFile: boolean;
}

const TranscriptionControls: React.FC<TranscriptionControlsProps> = ({
  onTranscribe,
  isTranscribing,
  hasFile,
}) => {
  if (!hasFile) return null;

  return (
    <Card className="mb-6 border-amber-200 shadow-lg">
      <CardContent className="p-6 text-center">
        <Button
          onClick={onTranscribe}
          disabled={isTranscribing}
          size="lg"
          className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold px-8 py-3 rounded-xl shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105"
        >
          {isTranscribing ? (
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
  );
};

export default TranscriptionControls;
