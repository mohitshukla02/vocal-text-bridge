
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import AudioPlayer from './AudioPlayer';

interface AudioPlayerSectionProps {
  audioUrl: string | null;
  fileName: string;
}

const AudioPlayerSection: React.FC<AudioPlayerSectionProps> = ({ audioUrl, fileName }) => {
  if (!audioUrl) return null;

  return (
    <Card className="mb-6 border-amber-200 shadow-lg">
      <CardContent className="p-6">
        <AudioPlayer
          audioUrl={audioUrl}
          fileName={fileName}
        />
      </CardContent>
    </Card>
  );
};

export default AudioPlayerSection;
