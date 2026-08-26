import React from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Download } from 'lucide-react';
import { channelClass } from '@/lib/speakerColors';

interface Utterance {
  id: string;
  speaker: string;
  text: string;
  start: number;
  end: number;
}

interface TranscriptDisplayProps {
  utterances?: Utterance[];
  speakerNames?: Record<string, string>;
  onCopy: () => void;
  onDownload: () => void;
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

const TranscriptDisplay: React.FC<TranscriptDisplayProps> = ({
  utterances = [],
  speakerNames = {},
  onCopy,
  onDownload,
}) => {
  const speakers = React.useMemo(() => {
    const seen: string[] = [];
    for (const u of utterances) {
      const s = String(u.speaker);
      if (!seen.includes(s)) seen.push(s);
    }
    return seen;
  }, [utterances]);

  const displayName = (speaker: string) => {
    const n = speakerNames[String(speaker)];
    return n && n.trim() ? n.trim() : `Speaker ${speaker}`;
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-medium text-foreground">Transcript</h2>
        <div className="flex gap-2">
          <Button onClick={onCopy} variant="outline" size="sm" className="h-7 rounded-sm text-xs">
            <Copy className="mr-1.5 h-3 w-3" />
            Copy
          </Button>
          <Button onClick={onDownload} variant="outline" size="sm" className="h-7 rounded-sm text-xs">
            <Download className="mr-1.5 h-3 w-3" />
            Save .txt
          </Button>
        </div>
      </div>

      <div className="max-h-[60vh] overflow-y-auto rounded-sm border border-border bg-card">
        {utterances.length > 0 ? (
          <div className="divide-y divide-border">
            {utterances.map((u) => (
              <div
                key={u.id || `${u.speaker}-${u.start}-${u.end}`}
                className="flex items-start gap-3 px-4 py-2"
              >
                <span className="shrink-0 pt-0.5 font-mono text-xs text-muted-foreground">
                  {formatTimestamp(u.start)}
                </span>
                <span className="flex shrink-0 items-center gap-1.5 pt-0.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${channelClass(speakers, u.speaker)}`} />
                  <span className="w-24 truncate text-xs font-medium text-foreground">
                    {displayName(u.speaker)}
                  </span>
                </span>
                <span className="text-sm leading-relaxed text-foreground">{u.text}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-4 py-6 text-sm text-muted-foreground">No transcript yet.</p>
        )}
      </div>
    </div>
  );
};

export default TranscriptDisplay;
