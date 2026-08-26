import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FolderOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const SettingsView: React.FC = () => {
  const { toast } = useToast();
  const [outputFolder, setOutputFolder] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        setOutputFolder(data.outputFolder);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleChooseFolder = async () => {
    if (!window.electronAPI) return;
    const folder = await window.electronAPI.pickFolder();
    if (!folder) return; // user cancelled
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outputFolder: folder }),
      });
      const data = await res.json();
      setOutputFolder(data.outputFolder);
      toast({ title: 'Transcripts folder set', description: folder });
    } catch (error) {
      toast({ title: 'Could not save setting', variant: 'destructive' });
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="flex max-w-lg flex-col gap-2">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Transcripts folder</p>
      <div className="flex items-center gap-3 rounded-sm border border-border bg-card px-4 py-3">
        <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate font-mono text-sm text-foreground">
          {outputFolder || 'Not set'}
        </span>
        {isElectron ? (
          <Button onClick={handleChooseFolder} variant="outline" size="sm" className="h-7 rounded-sm text-xs">
            Choose folder…
          </Button>
        ) : null}
      </div>
      {!isElectron && (
        <p className="text-xs text-muted-foreground">
          The folder picker only works in the Echotron desktop app, not the browser preview.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Every saved transcript is written here as{' '}
        <span className="font-mono">YYYY-MM-DD_OriginalName.txt</span>.
      </p>
    </div>
  );
};

export default SettingsView;
