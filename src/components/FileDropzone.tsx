import React, { useCallback, useState } from 'react';
import { Plus } from 'lucide-react';

export const ACCEPTED_EXTENSIONS = ['.m4a', '.mp4', '.mp3', '.wav', '.ogg', '.opus'];

interface FileDropzoneProps {
  onFileSelect: (file: File) => void;
}

const FileDropzone: React.FC<FileDropzoneProps> = ({ onFileSelect }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      // Pass through whatever was dropped (even a mismatched extension) so the
      // caller's validation can report exactly what's wrong, instead of
      // silently doing nothing when nothing in the drop looks like audio.
      const file = e.dataTransfer.files[0];
      if (file) onFileSelect(file);
    },
    [onFileSelect]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileSelect(file);
      e.target.value = ''; // allow re-selecting the same file
    },
    [onFileSelect]
  );

  return (
    <div
      className={`relative flex items-center gap-3 rounded-sm border px-4 py-3 transition-colors ${
        isDragOver ? 'border-primary bg-secondary/60' : 'border-border bg-card hover:bg-secondary/30'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Plus className="h-4 w-4 shrink-0 text-primary" strokeWidth={2} />
      <span className="text-sm text-foreground">Drop audio or browse</span>
      <span className="ml-auto font-mono text-xs text-muted-foreground">
        {ACCEPTED_EXTENSIONS.join(' ')}
      </span>
      <input
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(',')}
        onChange={handleFileInput}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </div>
  );
};

export default FileDropzone;
