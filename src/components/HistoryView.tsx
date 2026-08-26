import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { channelClass } from '@/lib/speakerColors';
import { useToast } from '@/hooks/use-toast';

export interface Utterance {
  id: string;
  speaker: string;
  text: string;
  start: number;
  end: number;
}

export interface HistoryRecord {
  id: string;
  date: string;
  originalFilename: string;
  savedFilename: string;
  savedPath: string;
  utterances: Utterance[];
  speakerNames: Record<string, string>;
  durationSeconds: number;
  sttCostINR: number;
  renameCostINR: number;
}

interface HistoryViewProps {
  onLoad: (record: HistoryRecord) => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

const HistoryView: React.FC<HistoryViewProps> = ({ onLoad }) => {
  const { toast } = useToast();
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      setRecords(data.history || []);
    } catch (error) {
      toast({ title: 'Could not load history', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await fetch(`/api/history/${id}`, { method: 'DELETE' });
      setRecords((prev) => prev.filter((r) => r.id !== id));
    } catch (error) {
      toast({ title: 'Could not delete entry', variant: 'destructive' });
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading history…</p>;
  }

  if (records.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No saved transcriptions yet. They'll show up here once you save one.
      </p>
    );
  }

  return (
    <div className="divide-y divide-border rounded-sm border border-border bg-card">
      {records.map((r) => {
        const speakers = Object.keys(r.speakerNames || {});
        return (
          <div
            key={r.id}
            onClick={() => onLoad(r)}
            className="flex cursor-pointer items-center gap-4 px-4 py-3 text-sm hover:bg-secondary/40"
          >
            <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">{r.date}</span>
            <span className="flex-1 truncate text-foreground">{r.originalFilename}</span>
            <span className="flex shrink-0 gap-1">
              {speakers.slice(0, 5).map((spk) => (
                <span key={spk} className={`h-2 w-2 rounded-full ${channelClass(speakers, spk)}`} />
              ))}
            </span>
            <span className="w-14 shrink-0 text-right font-mono text-xs text-muted-foreground">
              {formatDuration(r.durationSeconds)}
            </span>
            <span className="w-20 shrink-0 text-right font-mono text-xs text-muted-foreground">
              ₹{(r.sttCostINR + r.renameCostINR).toFixed(2)}
            </span>
            <Button
              onClick={(e) => handleDelete(e, r.id)}
              variant="ghost"
              size="sm"
              className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-destructive"
              aria-label="Delete entry"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      })}
    </div>
  );
};

export default HistoryView;
