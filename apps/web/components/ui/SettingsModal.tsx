'use client';

import { useState, useRef } from 'react';
import { X, LogOut, User, Camera, Loader2 } from 'lucide-react';
import { useRoomStore } from '@/stores/room';
import { clearSession, saveSession } from '@/lib/session';
import { generateAvatarUrl } from '@/lib/utils';
import { Button } from './button';
import { Input } from './input';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  currentAvatarUrl?: string | null;
  onProfileUpdate: (name?: string, avatarUrl?: string) => Promise<boolean>;
  onLeaveRoom: () => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  currentName,
  currentAvatarUrl,
  onProfileUpdate,
  onLeaveRoom,
}: SettingsModalProps) {
  const [name, setName] = useState(currentName);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const displayAvatar = avatarPreview || currentAvatarUrl || generateAvatarUrl(currentName);

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleSave = async () => {
    const hasNameChange = name.trim() && name.trim() !== currentName;
    const hasAvatarChange = avatarFile !== null;

    if (!hasNameChange && !hasAvatarChange) return;

    setIsSaving(true);

    try {
      let uploadedAvatarUrl: string | undefined;

      // Upload avatar if changed
      if (avatarFile) {
        setIsUploading(true);
        const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';
        const formData = new FormData();
        formData.append('image', avatarFile);

        const response = await fetch(`${serverUrl}/upload`, {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          uploadedAvatarUrl = data.imageUrl;
        } else {
          alert('Failed to upload avatar.');
          setIsUploading(false);
          setIsSaving(false);
          return;
        }
        setIsUploading(false);
      }

      // Update profile via socket
      const success = await onProfileUpdate(
        hasNameChange ? name.trim() : undefined,
        uploadedAvatarUrl
      );

      if (success) {
        if (hasNameChange) {
          saveSession(name.trim());
        }
        onClose();
      } else {
        alert('Failed to update profile.');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile.');
    }

    setIsSaving(false);
  };

  const handleLeave = () => {
    clearSession();
    onLeaveRoom();
  };

  const handleClose = () => {
    setAvatarPreview(null);
    setAvatarFile(null);
    setName(currentName);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-[#1C1C1E] border border-[#2A2A2A] rounded-xl w-full max-w-sm mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#2A2A2A]">
          <h2 className="text-[15px] font-medium text-white">Settings</h2>
          <button
            onClick={handleClose}
            className="p-1.5 text-[#555] hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Avatar */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <img
                src={displayAvatar}
                alt="Avatar"
                className="w-20 h-20 rounded-full bg-[#2A2A2A] object-cover"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="absolute bottom-0 right-0 p-1.5 bg-[#6E56CF] rounded-full text-white hover:bg-[#5B47B0] transition-colors"
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleAvatarSelect}
                className="hidden"
              />
            </div>
            <p className="text-[11px] text-[#555] mt-2">Click camera to change avatar</p>
          </div>

          {/* Change Name */}
          <div>
            <label className="flex items-center gap-2 text-[13px] text-[#888] mb-2">
              <User className="w-4 h-4" />
              Display Name
            </label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={
              (!name.trim() || (name.trim() === currentName && !avatarFile)) ||
              isSaving
            }
            className="w-full"
          >
            {isSaving ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </span>
            ) : (
              'Save Changes'
            )}
          </Button>

          {/* Divider */}
          <div className="border-t border-[#2A2A2A] pt-4">
            <button
              onClick={handleLeave}
              className="w-full flex items-center justify-center gap-2 p-3 text-[#EF4444] hover:bg-[#EF4444]/10 rounded-lg transition-colors text-[13px] font-medium"
            >
              <LogOut className="w-4 h-4" />
              Leave Room
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
