import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, FileText } from 'lucide-react';

interface TranscriptDisplayProps {
  transcript: string;
  utterances?: {
    id: string;
    speaker: string;
    text: string;
    start: number;
    end: number;
  }[];
  onCopy: () => void;
}

const TranscriptDisplay: React.FC<TranscriptDisplayProps> = ({ transcript, utterances = [], onCopy }) => {
  return (
    <Card className="border-amber-200 shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xl text-gray-800">
            <FileText className="w-5 h-5 text-amber-600" />
            Transcript
          </CardTitle>
          <Button
            onClick={onCopy}
            variant="outline"
            size="sm"
            className="border-amber-300 text-amber-700 hover:bg-amber-100 hover:border-amber-400 transition-colors"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copy
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg p-6 border border-amber-100">
          {utterances.length > 0 ? (
            <div className="space-y-4">
              {utterances.map(u => {
                let displayName = u.speaker;
                if (displayName.toLowerCase().startsWith('speaker ')) {
                  displayName = displayName;
                }
                return (
                  <div
                    key={u.id || `${u.speaker}-${u.start}-${u.end}`}
                    className="flex gap-3 items-start"
                  >
                    <span className="font-semibold text-amber-700 min-w-[90px]">
                      {displayName}:
                    </span>
                    <span className="text-gray-800 leading-relaxed whitespace-pre-wrap text-base">{u.text}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-800 leading-relaxed whitespace-pre-wrap text-base">
              {transcript}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TranscriptDisplay;
