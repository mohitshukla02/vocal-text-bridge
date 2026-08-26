import React from 'react';
import { AudioLines, History, IndianRupee, Settings } from 'lucide-react';

export type ViewId = 'transcribe' | 'history' | 'cost' | 'settings';

interface NavRailProps {
  active: ViewId;
  onSelect: (view: ViewId) => void;
}

const ITEMS: { id: ViewId; label: string; icon: React.ElementType }[] = [
  { id: 'transcribe', label: 'Transcribe', icon: AudioLines },
  { id: 'history', label: 'History', icon: History },
  { id: 'cost', label: 'Cost', icon: IndianRupee },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const NavRail: React.FC<NavRailProps> = ({ active, onSelect }) => {
  return (
    <nav className="flex h-full w-20 shrink-0 flex-col items-center gap-1 border-r border-border bg-card py-4">
      <div className="mb-4 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
      {ITEMS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onSelect(id)}
          className={`flex w-16 flex-col items-center gap-1 rounded-sm py-2 text-[11px] font-display transition-colors ${
            active === id
              ? 'bg-secondary text-primary'
              : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
          }`}
          aria-current={active === id}
        >
          <Icon className="h-4 w-4" strokeWidth={1.75} />
          {label}
        </button>
      ))}
    </nav>
  );
};

export default NavRail;
