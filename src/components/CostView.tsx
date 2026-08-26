import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { HistoryRecord } from './HistoryView';

interface CostSummary {
  allTimeTotalINR: number;
  allTimeSTTINR: number;
  allTimeRenameINR: number;
  monthTotalINR: number;
  monthSTTINR: number;
  monthRenameINR: number;
  recordCount: number;
}

const CostView: React.FC = () => {
  const { toast } = useToast();
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [summaryRes, historyRes] = await Promise.all([
          fetch('/api/cost-summary'),
          fetch('/api/history'),
        ]);
        setSummary(await summaryRes.json());
        const historyData = await historyRes.json();
        setHistory(historyData.history || []);
      } catch (error) {
        toast({ title: 'Could not load cost data', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!summary) return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">This month, estimated</p>
        <p className="font-display text-4xl font-semibold text-foreground">
          ₹{summary.monthTotalINR.toFixed(2)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          ₹{summary.monthSTTINR.toFixed(2)} transcription · ₹{summary.monthRenameINR.toFixed(2)} speaker naming
        </p>
      </div>

      <div className="flex gap-8 border-t border-border pt-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">All-time</p>
          <p className="font-mono text-lg text-foreground">₹{summary.allTimeTotalINR.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Transcriptions saved</p>
          <p className="font-mono text-lg text-foreground">{summary.recordCount}</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Estimated from Sarvam's published rates (₹45/hr transcription+diarization, per-token
        chat pricing for speaker naming) — not a live billing pull. Check{' '}
        <span className="font-mono">dashboard.sarvam.ai/usage</span> for your actual invoice.
      </p>

      {history.length > 0 && (
        <div className="rounded-sm border border-border">
          <div className="grid grid-cols-[6rem_1fr_5rem_5rem_5rem] gap-2 border-b border-border px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground">
            <span>Date</span>
            <span>File</span>
            <span className="text-right">STT</span>
            <span className="text-right">Naming</span>
            <span className="text-right">Total</span>
          </div>
          <div className="divide-y divide-border">
            {history.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-[6rem_1fr_5rem_5rem_5rem] gap-2 px-4 py-2 text-sm"
              >
                <span className="font-mono text-xs text-muted-foreground">{r.date}</span>
                <span className="truncate text-foreground">{r.originalFilename}</span>
                <span className="text-right font-mono text-xs text-muted-foreground">
                  ₹{r.sttCostINR.toFixed(2)}
                </span>
                <span className="text-right font-mono text-xs text-muted-foreground">
                  ₹{r.renameCostINR.toFixed(2)}
                </span>
                <span className="text-right font-mono text-xs text-foreground">
                  ₹{(r.sttCostINR + r.renameCostINR).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CostView;
