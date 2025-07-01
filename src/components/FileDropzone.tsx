
import React, { useCallback, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileAudio } from 'lucide-react';

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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const m4aFile = files.find(file => 
      file.name.toLowerCase().endsWith('.m4a') || file.type === 'audio/mp4'
    );

    if (m4aFile) {
      onFileSelect(m4aFile);
    }
  }, [onFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  }, [onFileSelect]);

  return (
    <div
      className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
        isDragOver
          ? 'border-amber-400 bg-amber-50 scale-105'
          : 'border-amber-300 bg-amber-50/30 hover:bg-amber-50/50'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center gap-4">
        <div className={`p-4 rounded-full transition-all duration-300 ${
          isDragOver 
            ? 'bg-amber-500 text-white scale-110' 
            : 'bg-amber-100 text-amber-600'
        }`}>
          <FileAudio className="w-8 h-8" />
        </div>
        
        <div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            Drop your .m4a file here
          </h3>
          <p className="text-gray-600 mb-4">
            or click to browse and select your voice note
          </p>
        </div>

        <Button
          variant="outline"
          className="border-amber-300 text-amber-700 hover:bg-amber-100 hover:border-amber-400 transition-colors"
        >
          <Upload className="w-4 h-4 mr-2" />
          Choose File
        </Button>
      </div>

      <input
        type="file"
        accept=".m4a,audio/mp4"
        onChange={handleFileInput}
        className="absolute inset-0 opacity-0 cursor-pointer"
      />
    </div>
  );
};

export default FileDropzone;
