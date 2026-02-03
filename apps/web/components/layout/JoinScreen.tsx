'use client';

import { useState } from 'react';
import { Icon } from '@iconify/react';
import { Loader2 } from 'lucide-react';

interface JoinScreenProps {
  roomSlug: string;
  isConnected: boolean;
  isJoining: boolean;
  error: string | null;
  onJoin: (name: string) => void;
}

export function JoinScreen({
  roomSlug,
  isConnected,
  isJoining,
  error,
  onJoin,
}: JoinScreenProps) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && isConnected && !isJoining) {
      onJoin(name.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Blur backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Join card */}
      <div className="relative w-full max-w-[360px] glass-panel rounded-3xl p-8 animate-enter flex flex-col gap-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[var(--accent)]/20 to-blue-500/10 border border-white/5 flex items-center justify-center mx-auto mb-4 text-[var(--accent)]">
            <Icon icon="solar:chat-round-line-linear" width={24} />
          </div>
          <h1 className="text-xl font-medium text-white tracking-tight">
            Enter Workspace
          </h1>
          <p className="text-xs text-slate-400">
            Join the <span className="text-[var(--accent)]">#{roomSlug}</span> room
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-[var(--error)]/10 border border-[var(--error)]/20 rounded-xl text-[var(--error)] text-[13px]">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider ml-1">
              Display Name
            </label>
            <input
              type="text"
              placeholder="e.g. Alex Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full glass-input rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/50 transition-all"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider ml-1">
              Room ID
            </label>
            <div className="relative">
              <span className="absolute left-4 top-3 text-slate-500 text-sm">#</span>
              <input
                type="text"
                value={roomSlug}
                readOnly
                className="w-full glass-input rounded-xl pl-8 pr-4 py-3 text-sm text-slate-400 focus:outline-none cursor-not-allowed"
              />
            </div>
          </div>

          {/* Status indicator */}
          <div className="flex items-center justify-center gap-2 text-xs">
            {!isConnected && (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-slate-500" />
                <span className="text-slate-500">Connecting...</span>
              </>
            )}
            {isConnected && !isJoining && (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
                <span className="text-[var(--success)]">Connected</span>
              </>
            )}
            {isJoining && (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-[var(--accent)]" />
                <span className="text-[var(--accent)]">Joining...</span>
              </>
            )}
          </div>

          <button
            type="submit"
            disabled={!name.trim() || !isConnected || isJoining}
            className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-black/80 font-medium py-3 rounded-xl transition-all active:scale-[0.98] shadow-[0_0_20px_var(--accent-glow)] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 mt-2"
          >
            {isJoining ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Joining...
              </span>
            ) : (
              'Enter'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
