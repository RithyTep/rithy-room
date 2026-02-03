'use client';

import {
  useState,
  useRef,
  useEffect,
  type FormEvent,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import { Icon } from '@iconify/react';
import { Loader2, X, Mic, Square, Upload } from 'lucide-react';
import { EmojiPicker } from './EmojiPicker';
import { GifPicker } from './GifPicker';
import { cn } from '@/lib/utils';

interface MessageInputProps {
  onSend: (text: string, imageUrl?: string, audioUrl?: string) => void;
  disabled?: boolean;
  roomSlug?: string;
}

export function MessageInput({ onSend, disabled, roomSlug }: MessageInputProps) {
  const [text, setText] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if ((!text.trim() && !imageFile && !audioBlob && !gifUrl) || disabled || isUploading) return;

    let imageUrl: string | undefined;
    let audioUrl: string | undefined;

    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';

    if (gifUrl) {
      imageUrl = gifUrl;
    }

    if (imageFile) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('image', imageFile);

        const response = await fetch(`${serverUrl}/upload`, {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          imageUrl = data.imageUrl;
        } else {
          alert('Failed to upload image.');
          setIsUploading(false);
          return;
        }
      } catch (error) {
        console.error('Failed to upload image:', error);
        alert('Failed to upload image.');
        setIsUploading(false);
        return;
      }
    }

    if (audioBlob) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('image', audioBlob, 'voice.webm');

        const response = await fetch(`${serverUrl}/upload`, {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          audioUrl = data.audioUrl;
        } else {
          alert('Failed to upload voice message.');
          setIsUploading(false);
          return;
        }
      } catch (error) {
        console.error('Failed to upload audio:', error);
        alert('Failed to upload voice message.');
        setIsUploading(false);
        return;
      }
    }

    setIsUploading(false);
    onSend(text.trim() || (audioBlob ? '🎤 Voice message' : gifUrl ? '' : '📷'), imageUrl, audioUrl);
    setText('');
    setImagePreview(null);
    setImageFile(null);
    setGifUrl(null);
    setAudioBlob(null);
    setRecordingTime(0);
  };

  const handleEmojiSelect = (emoji: string) => {
    setText((prev) => prev + emoji);
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const clearImage = () => {
    setImagePreview(null);
    setImageFile(null);
  };

  const clearAudio = () => {
    setAudioBlob(null);
    setRecordingTime(0);
  };

  const handleGifSelect = (url: string) => {
    setGifUrl(url);
    setImagePreview(null);
    setImageFile(null);
    setAudioBlob(null);
  };

  const clearGif = () => {
    setGifUrl(null);
  };

  const processImageFile = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      setImageFile(file);
      setGifUrl(null);
      setAudioBlob(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        processImageFile(file);
      }
    }
  };

  useEffect(() => {
    const handleGlobalPaste = (e: globalThis.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            processImageFile(file);
          }
          break;
        }
      }
    };

    document.addEventListener('paste', handleGlobalPaste);
    return () => {
      document.removeEventListener('paste', handleGlobalPaste);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Could not access microphone. Please allow microphone access.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={dropZoneRef}
      className="relative max-w-3xl mx-auto"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-[var(--accent)]/20 border-2 border-dashed border-[var(--accent)] rounded-2xl flex items-center justify-center z-10 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 text-[var(--accent)]">
            <Upload className="w-8 h-8" />
            <span className="text-[14px] font-medium">Drop image here</span>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Previews above input */}
      {(imagePreview || gifUrl || (audioBlob && !isRecording)) && (
        <div className="mb-2 flex flex-wrap gap-2">
          {/* Image Preview */}
          {imagePreview && (
            <div className="relative inline-block">
              <img
                src={imagePreview}
                alt="Preview"
                className="max-h-24 rounded-lg border border-white/10"
              />
              <button
                type="button"
                onClick={clearImage}
                className="absolute -top-2 -right-2 p-1 bg-[var(--error)] rounded-full text-white hover:opacity-90 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* GIF Preview */}
          {gifUrl && (
            <div className="relative inline-block">
              <img
                src={gifUrl}
                alt="GIF"
                className="max-h-24 rounded-lg border border-white/10"
              />
              <button
                type="button"
                onClick={clearGif}
                className="absolute -top-2 -right-2 p-1 bg-[var(--error)] rounded-full text-white hover:opacity-90 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Audio Preview */}
          {audioBlob && !isRecording && (
            <div className="flex items-center gap-3 bg-black/20 border border-white/10 rounded-lg p-2">
              <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center shrink-0">
                <Mic className="w-4 h-4 text-black" />
              </div>
              <audio
                src={URL.createObjectURL(audioBlob)}
                controls
                className="h-8 max-w-[200px]"
              />
              <button
                type="button"
                onClick={clearAudio}
                className="p-1.5 text-[var(--error)] hover:bg-[var(--error)]/10 rounded transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Input wrapper with glow effect */}
      <div className="relative group">
        {/* Glow effect */}
        <div className="absolute -inset-px bg-gradient-to-r from-[var(--accent)]/20 via-transparent to-[var(--accent)]/20 rounded-2xl blur opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition duration-700" />

        <form
          onSubmit={handleSubmit}
          className="relative flex items-center gap-2 glass-panel !bg-black/40 rounded-2xl p-2 pl-4 transition-all focus-within:ring-1 focus-within:ring-[var(--accent)]/30"
        >
          <button
            type="button"
            onClick={handleUploadClick}
            disabled={isUploading || isRecording}
            className="text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-50"
          >
            <Icon icon="solar:add-circle-linear" width={20} />
          </button>

          {isRecording ? (
            <div className="flex-1 flex items-center gap-3 px-2">
              <div className="w-2 h-2 rounded-full bg-[var(--error)] animate-pulse" />
              <span className="text-[14px] text-[var(--error)]">
                Recording {formatTime(recordingTime)}
              </span>
            </div>
          ) : (
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Message ${roomSlug ? `#${roomSlug}` : ''}...`}
              disabled={disabled || isUploading}
              className="flex-1 bg-transparent border-none text-sm text-slate-200 placeholder-slate-600 focus:outline-none py-2"
            />
          )}

          <div className="flex items-center gap-1 pr-1">
            {!isRecording && !audioBlob && !gifUrl && (
              <>
                <GifPicker onSelect={handleGifSelect} />
                <EmojiPicker onSelect={handleEmojiSelect} />
              </>
            )}

            {/* Voice record or Send button */}
            {!text.trim() && !imageFile && !audioBlob && !gifUrl ? (
              <button
                type="button"
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={isRecording ? stopRecording : undefined}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                disabled={disabled || isUploading}
                className={cn(
                  'p-1.5 rounded-lg transition-colors',
                  isRecording
                    ? 'bg-[var(--error)] text-white'
                    : 'text-slate-500 hover:text-[var(--accent)] hover:bg-white/5'
                )}
                title="Hold to record voice message"
              >
                {isRecording ? (
                  <Square className="w-[18px] h-[18px]" />
                ) : (
                  <Icon icon="solar:microphone-2-linear" width={18} />
                )}
              </button>
            ) : (
              <button
                type="submit"
                disabled={
                  (!text.trim() && !imageFile && !audioBlob && !gifUrl) || disabled || isUploading
                }
                className="p-1.5 bg-white/10 text-white rounded-lg hover:bg-[var(--accent)] hover:text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <Loader2 className="w-[18px] h-[18px] animate-spin" />
                ) : (
                  <Icon icon="solar:arrow-right-linear" width={18} />
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
