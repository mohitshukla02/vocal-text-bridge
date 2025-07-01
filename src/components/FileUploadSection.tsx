
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import FileDropzone from './FileDropzone';

interface FileUploadSectionProps {
  onFileSelect: (file: File) => void;
}

const FileUploadSection: React.FC<FileUploadSectionProps> = ({ onFileSelect }) => {
  return (
    <Card className="mb-6 border-amber-200 shadow-lg">
      <CardContent className="p-6">
        <FileDropzone onFileSelect={onFileSelect} />
      </CardContent>
    </Card>
  );
};

export default FileUploadSection;
