'use client';

import { useState, useRef, type FormEvent, type ChangeEvent } from 'react';
import { ArrowRight, PlusCircle, X, Loader2, Mic, Square } from 'lucide-react';
import { EmojiPicker } from './EmojiPicker';
import { cn } from '@/lib/utils';

interface MessageInputProps {
  onSend: (text: string, imageUrl?: string, audioUrl?: string) => void;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [text, setText] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if ((!text.trim() && !imageFile && !audioBlob) || disabled || isUploading) return;

    let imageUrl: string | undefined;
    let audioUrl: string | undefined;

    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';

    // Upload image if exists
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
          // Cloudinary returns full URL directly
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

    // Upload audio if exists
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
          // Cloudinary returns full URL directly
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
    onSend(text.trim() || (audioBlob ? '🎤 Voice message' : '📷'), imageUrl, audioUrl);
    setText('');
    setImagePreview(null);
    setImageFile(null);
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
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
        stream.getTracks().forEach(track => track.stop());
      };

      // Request data every 100ms to ensure we capture everything
      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
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
    <div className="p-4 md:p-6 pt-2 shrink-0">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Image Preview */}
      {imagePreview && (
        <div className="mb-2 relative inline-block">
          <img
            src={imagePreview}
            alt="Preview"
            className="max-h-32 rounded-lg border border-[#242426]"
          />
          <button
            type="button"
            onClick={clearImage}
            className="absolute -top-2 -right-2 p-1 bg-[#EF4444] rounded-full text-white hover:bg-[#DC2626] transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Audio Preview */}
      {audioBlob && !isRecording && (
        <div className="mb-2 flex items-center gap-3 bg-[#1C1C1E] border border-[#242426] rounded-lg p-3 inline-flex">
          <div className="w-8 h-8 rounded-full bg-[#6E56CF] flex items-center justify-center shrink-0">
            <Mic className="w-4 h-4 text-white" />
          </div>
          <audio
            src={URL.createObjectURL(audioBlob)}
            controls
            className="h-8 max-w-[200px]"
          />
          <button
            type="button"
            onClick={clearAudio}
            className="p-1.5 text-[#EF4444] hover:bg-[#EF4444]/10 rounded transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-[#161618] border border-[#242426] rounded-xl flex items-center p-1.5 focus-within:border-[#444] transition-colors shadow-sm"
      >
        <button
          type="button"
          onClick={handleUploadClick}
          disabled={isUploading || isRecording}
          className="p-2 text-[#555] hover:text-[#DDD] rounded-lg transition-colors disabled:opacity-50"
        >
          <PlusCircle className="w-5 h-5" />
        </button>

        {isRecording ? (
          <div className="flex-1 flex items-center gap-3 px-2">
            <div className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse" />
            <span className="text-[14px] text-[#EF4444]">Recording {formatTime(recordingTime)}</span>
          </div>
        ) : (
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={imageFile ? 'Add a caption...' : audioBlob ? 'Add a caption...' : 'Type a message...'}
            disabled={disabled || isUploading}
            className="flex-1 bg-transparent border-none text-[14px] text-[#EDEDED] placeholder-[#444] px-2 focus:outline-none h-full"
          />
        )}

        <div className="flex items-center gap-1 pr-1">
          {!isRecording && !audioBlob && <EmojiPicker onSelect={handleEmojiSelect} />}

          {/* Voice record button */}
          {!text.trim() && !imageFile && !audioBlob ? (
            <button
              type="button"
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onMouseLeave={isRecording ? stopRecording : undefined}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              disabled={disabled || isUploading}
              className={cn(
                'p-2 rounded-lg transition-colors',
                isRecording
                  ? 'bg-[#EF4444] text-white'
                  : 'bg-[#2A2A2A] text-[#888] hover:text-white'
              )}
              title="Hold to record voice message"
            >
              {isRecording ? (
                <Square className="w-[18px] h-[18px]" />
              ) : (
                <Mic className="w-[18px] h-[18px]" />
              )}
            </button>
          ) : (
            <button
              type="submit"
              disabled={(!text.trim() && !imageFile && !audioBlob) || disabled || isUploading}
              className="p-2 bg-[#EDEDED] text-black rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <Loader2 className="w-[18px] h-[18px] animate-spin" />
              ) : (
                <ArrowRight className="w-[18px] h-[18px]" />
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
