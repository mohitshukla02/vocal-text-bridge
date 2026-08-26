import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader, Save } from 'lucide-react';
import FileDropzone, { ACCEPTED_EXTENSIONS } from './FileDropzone';
import AudioPlayer from './AudioPlayer';
import TranscriptDisplay from './TranscriptDisplay';
import SpeakerNameEditor from './SpeakerNameEditor';
import type { HistoryRecord, Utterance } from './HistoryView';

interface TranscriptionState {
  file: File | null;
  audioUrl: string | null;
  originalFilename: string | null;
  utterances: Utterance[];
  durationSeconds: number;
  sttCostINR: number;
  isTranscribing: boolean;
}

interface TranscribeViewProps {
  loadedRecord: HistoryRecord | null;
  onSaved: () => void;
}

const TranscribeView: React.FC<TranscribeViewProps> = ({ loadedRecord, onSaved }) => {
  const { toast } = useToast();
  const [state, setState] = useState<TranscriptionState>({
    file: null,
    audioUrl: null,
    originalFilename: null,
    utterances: [],
    durationSeconds: 0,
    sttCostINR: 0,
    isTranscribing: false,
  });
  const [speakerNames, setSpeakerNames] = useState<Record<string, string>>({});
  const [renameCostINR, setRenameCostINR] = useState(0);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Distinguishes "just transcribed" (should auto-suggest + auto-save) from
  // "loaded from history" (should not) — both set state.utterances, so a
  // plain effect on that array can't tell them apart.
  const freshTranscriptionRef = useRef(false);

  // Loading a history entry replaces the current view with its saved state.
  useEffect(() => {
    if (!loadedRecord) return;
    setState({
      file: null,
      audioUrl: null,
      originalFilename: loadedRecord.originalFilename,
      utterances: loadedRecord.utterances,
      durationSeconds: loadedRecord.durationSeconds,
      sttCostINR: loadedRecord.sttCostINR,
      isTranscribing: false,
    });
    setSpeakerNames(loadedRecord.speakerNames || {});
    setRenameCostINR(loadedRecord.renameCostINR || 0);
  }, [loadedRecord]);

  const handleFileSelect = (file: File) => {
    const name = file.name.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
      toast({
        title: 'Unsupported file type',
        description: `${file.name} — accepted: ${ACCEPTED_EXTENSIONS.join(', ')}`,
        variant: 'destructive',
      });
      return;
    }
    const audioUrl = URL.createObjectURL(file);
    setState({
      file,
      audioUrl,
      originalFilename: file.name,
      utterances: [],
      durationSeconds: 0,
      sttCostINR: 0,
      isTranscribing: false,
    });
    setSpeakerNames({});
    setRenameCostINR(0);
    toast({ title: 'File loaded', description: `${file.name} is ready to transcribe.` });
  };

  const handleTranscribe = async () => {
    if (!state.file) return;
    setState((prev) => ({ ...prev, isTranscribing: true }));
    setSpeakerNames({});
    setRenameCostINR(0);
    try {
      const formData = new FormData();
      formData.append('audio', state.file);
      const response = await fetch('/api/transcribe', { method: 'POST', body: formData });
      if (!response.ok) {
        const errorData = await response.json();
        const message = [errorData.error, errorData.details].filter(Boolean).join(': ');
        throw new Error(message || 'Transcription failed');
      }
      const data = await response.json();
      freshTranscriptionRef.current = true;
      setState((prev) => ({
        ...prev,
        utterances: data.utterances || [],
        durationSeconds: data.durationSeconds || 0,
        sttCostINR: data.sttCostINR || 0,
        isTranscribing: false,
      }));
      toast({ title: 'Transcription complete', description: `${data.utterances?.length ?? 0} lines.` });
    } catch (error) {
      console.error('Transcription error:', error);
      setState((prev) => ({ ...prev, isTranscribing: false }));
      toast({
        title: 'Transcription failed',
        description: error instanceof Error ? error.message : 'An error occurred during transcription.',
        variant: 'destructive',
      });
    }
  };

  const speakers = React.useMemo(() => {
    const seen: string[] = [];
    for (const u of state.utterances) {
      const s = String(u.speaker);
      if (!seen.includes(s)) seen.push(s);
    }
    return seen;
  }, [state.utterances]);

  const handleSave = useCallback(
    async (silent: boolean, overrides?: { speakerNames?: Record<string, string>; renameCostINR?: number }) => {
      if (!state.originalFilename || state.utterances.length === 0) return;
      setIsSaving(true);
      try {
        const response = await fetch('/api/finalize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originalFilename: state.originalFilename,
            utterances: state.utterances,
            speakerNames: overrides?.speakerNames ?? speakerNames,
            durationSeconds: state.durationSeconds,
            sttCostINR: state.sttCostINR,
            renameCostINR: overrides?.renameCostINR ?? renameCostINR,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          if (data.error === 'NO_OUTPUT_FOLDER') {
            toast({
              title: 'No transcripts folder set',
              description: 'Choose one in Settings, then save again.',
              variant: 'destructive',
            });
            return;
          }
          throw new Error([data.error, data.details].filter(Boolean).join(': ') || 'Save failed');
        }
        if (!silent) {
          toast({ title: 'Saved', description: data.savedPath });
        }
        onSaved();
      } catch (error) {
        toast({
          title: 'Could not save transcript',
          description: error instanceof Error ? error.message : undefined,
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
    },
    [state, speakerNames, renameCostINR, onSaved, toast]
  );

  // Returns the merged names + cost directly (rather than relying on state,
  // which wouldn't have flushed yet if a caller awaits this then reads state
  // in the same tick).
  const suggestSpeakerNames = useCallback(async (): Promise<{
    names: Record<string, string>;
    renameCostINR: number;
  }> => {
    if (!state.utterances.length) return { names: {}, renameCostINR: 0 };
    setIsSuggesting(true);
    try {
      const response = await fetch('/api/rename-speakers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ utterances: state.utterances }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Name suggestion failed');
      }
      const data = await response.json();
      const suggested: Record<string, string> = (data && data.names) || {};
      let merged: Record<string, string> = {};
      setSpeakerNames((prev) => {
        merged = { ...prev };
        for (const [k, v] of Object.entries(suggested)) {
          if (!merged[k]) merged[k] = String(v);
        }
        return merged;
      });
      const cost = data.renameCostINR || 0;
      setRenameCostINR(cost);
      return { names: merged, renameCostINR: cost };
    } catch (error) {
      // Non-fatal: user can still name speakers manually.
      console.error('Name suggestion error:', error);
      return { names: speakerNames, renameCostINR: 0 };
    } finally {
      setIsSuggesting(false);
    }
  }, [state.utterances, speakerNames]);

  // Auto-suggest names, then auto-save — "automatically" means no click required.
  // Re-saving later (e.g. after editing names) still needs the manual Save button.
  useEffect(() => {
    if (state.utterances.length === 0) return;
    if (!freshTranscriptionRef.current) return; // loaded from history, not a new transcription
    freshTranscriptionRef.current = false;
    (async () => {
      const { names, renameCostINR: cost } = await suggestSpeakerNames();
      await handleSave(true, { speakerNames: names, renameCostINR: cost });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.utterances]);

  const displayName = (speaker: string) => {
    const n = speakerNames[String(speaker)];
    return n && n.trim() ? n.trim() : `Speaker ${speaker}`;
  };

  const buildPlainTranscript = () =>
    state.utterances.map((u) => `${displayName(u.speaker)}: ${u.text}`).join('\n\n');

  const handleNameChange = (speaker: string, value: string) => {
    setSpeakerNames((prev) => ({ ...prev, [speaker]: value }));
  };

  const handleCopyTranscript = async () => {
    const text = buildPlainTranscript();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied to clipboard' });
    } catch (error) {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  const handleDownloadTxt = () => {
    const text = buildPlainTranscript();
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const base = state.originalFilename?.replace(/\.[^.]+$/, '') || 'transcript';
    a.download = `${base}-transcript.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-5">
      <FileDropzone onFileSelect={handleFileSelect} />

      {state.audioUrl && <AudioPlayer audioUrl={state.audioUrl} fileName={state.originalFilename || 'Audio file'} />}

      {state.file && state.utterances.length === 0 && (
        <Button
          onClick={handleTranscribe}
          disabled={state.isTranscribing}
          className="h-9 w-fit rounded-sm"
        >
          {state.isTranscribing ? (
            <>
              <Loader className="mr-2 h-4 w-4 animate-spin" />
              Transcribing…
            </>
          ) : (
            'Transcribe'
          )}
        </Button>
      )}

      {state.utterances.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <SpeakerNameEditor
              speakers={speakers}
              names={speakerNames}
              onChange={handleNameChange}
              isSuggesting={isSuggesting}
            />
            <Button
              onClick={() => handleSave(false)}
              disabled={isSaving}
              variant="outline"
              size="sm"
              className="h-7 shrink-0 rounded-sm text-xs"
            >
              <Save className="mr-1.5 h-3 w-3" />
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </div>

          <TranscriptDisplay
            utterances={state.utterances}
            speakerNames={speakerNames}
            onCopy={handleCopyTranscript}
            onDownload={handleDownloadTxt}
          />
        </>
      )}
    </div>
  );
};

export default TranscribeView;
