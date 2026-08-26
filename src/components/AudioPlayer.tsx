
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Volume2 } from 'lucide-react';

interface AudioPlayerProps {
  audioUrl: string;
  fileName: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioUrl, fileName }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const progressBar = e.currentTarget;
    if (!audio || !progressBar) return;

    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const progressWidth = rect.width;
    const newTime = (clickX / progressWidth) * duration;

    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 rounded-sm border border-border bg-card px-4 py-2.5">
      <Button
        onClick={togglePlayPause}
        size="sm"
        variant="outline"
        className="h-8 w-8 shrink-0 rounded-full p-0"
      >
        {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="ml-0.5 h-3.5 w-3.5" />}
      </Button>

      <Volume2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="w-40 shrink-0 truncate text-sm text-foreground">{fileName}</span>

      <div className="h-1.5 flex-1 cursor-pointer rounded-full bg-secondary" onClick={handleProgressClick}>
        <div
          className="h-full rounded-full bg-primary transition-all duration-150"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      <span className="shrink-0 font-mono text-xs text-muted-foreground">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>

      <audio ref={audioRef} src={audioUrl} preload="metadata" />
    </div>
  );
};

export default AudioPlayer;
