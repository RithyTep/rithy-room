'use client';

import { useState } from 'react';
import { X, LogOut, User } from 'lucide-react';
import { useRoomStore } from '@/stores/room';
import { clearSession, saveSession } from '@/lib/session';
import { Button } from './button';
import { Input } from './input';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  onNameChange: (newName: string) => void;
  onLeaveRoom: () => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  currentName,
  onNameChange,
  onLeaveRoom,
}: SettingsModalProps) {
  const [name, setName] = useState(currentName);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (name.trim() && name.trim() !== currentName) {
      setIsSaving(true);
      saveSession(name.trim());
      onNameChange(name.trim());
      setIsSaving(false);
      onClose();
    }
  };

  const handleLeave = () => {
    clearSession();
    onLeaveRoom();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[#1C1C1E] border border-[#2A2A2A] rounded-xl w-full max-w-sm mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#2A2A2A]">
          <h2 className="text-[15px] font-medium text-white">Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-[#555] hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
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
            disabled={!name.trim() || name.trim() === currentName || isSaving}
            className="w-full"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
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
