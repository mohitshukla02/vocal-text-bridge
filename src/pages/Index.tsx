import { useState } from 'react';
import NavRail, { ViewId } from '../components/NavRail';
import TranscribeView from '../components/TranscribeView';
import HistoryView, { HistoryRecord } from '../components/HistoryView';
import CostView from '../components/CostView';
import SettingsView from '../components/SettingsView';

const VIEW_TITLES: Record<ViewId, string> = {
  transcribe: 'Transcribe',
  history: 'History',
  cost: 'Cost',
  settings: 'Settings',
};

const Index = () => {
  const [view, setView] = useState<ViewId>('transcribe');
  const [loadedRecord, setLoadedRecord] = useState<HistoryRecord | null>(null);
  const [historyKey, setHistoryKey] = useState(0); // bump to force HistoryView/CostView refetch

  const handleLoadRecord = (record: HistoryRecord) => {
    setLoadedRecord(record);
    setView('transcribe');
  };

  const handleSaved = () => {
    setHistoryKey((k) => k + 1);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <NavRail active={view} onSelect={setView} />
      <div className="flex-1 overflow-y-auto">
        <header className="flex items-center gap-3 border-b border-border px-8 py-4">
          <h1 className="font-display text-lg font-semibold text-foreground">Echotron</h1>
          <span className="text-sm text-muted-foreground">/ {VIEW_TITLES[view]}</span>
        </header>
        <main className="mx-auto max-w-3xl px-8 py-6">
          {view === 'transcribe' && <TranscribeView loadedRecord={loadedRecord} onSaved={handleSaved} />}
          {view === 'history' && <HistoryView key={historyKey} onLoad={handleLoadRecord} />}
          {view === 'cost' && <CostView key={historyKey} />}
          {view === 'settings' && <SettingsView />}
        </main>
      </div>
    </div>
  );
};

export default Index;
