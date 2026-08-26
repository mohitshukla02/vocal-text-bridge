import React from 'react';
import { Loader } from 'lucide-react';
import { channelClass } from '@/lib/speakerColors';

interface SpeakerNameEditorProps {
  speakers: string[];
  names: Record<string, string>;
  onChange: (speaker: string, value: string) => void;
  isSuggesting?: boolean;
}

const SpeakerNameEditor: React.FC<SpeakerNameEditorProps> = ({
  speakers,
  names,
  onChange,
  isSuggesting,
}) => {
  if (!speakers.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="font-display text-xs uppercase tracking-wide text-muted-foreground">
        Speakers
      </span>
      {speakers.map((spk) => (
        <div key={spk} className="flex items-center gap-1.5">
          <span className={`h-2 w-2 shrink-0 rounded-full ${channelClass(speakers, spk)}`} />
          <input
            value={names[spk] ?? ''}
            onChange={(e) => onChange(spk, e.target.value)}
            placeholder={`Speaker ${spk}`}
            className="w-32 border-b border-border bg-transparent py-0.5 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>
      ))}
      {isSuggesting && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Loader className="h-3 w-3 animate-spin" /> suggesting…
        </span>
      )}
    </div>
  );
};

export default SpeakerNameEditor;
