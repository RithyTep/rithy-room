'use client';

import { Mic, MicOff } from 'lucide-react';
import { generateAvatarUrl } from '@/lib/utils';
import type { Member } from '@rithy-room/shared';

interface MemberItemProps {
  member: Member;
  isCurrentUser?: boolean;
  isMuted?: boolean;
}

export function MemberItem({
  member,
  isCurrentUser,
  isMuted,
}: MemberItemProps) {
  return (
    <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[#1C1C1E] group cursor-default transition-colors">
      <div className="relative">
        <img
          src={generateAvatarUrl(member.name)}
          alt={member.name}
          className="w-8 h-8 rounded-full bg-[#2A2A2A]"
        />
        {member.online && (
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#161618] rounded-full flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-[#4ADE80] rounded-full" />
          </div>
        )}
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <span className="text-[13px] font-medium text-[#DDD] truncate">
          {member.name}
          {isCurrentUser && (
            <span className="text-[#555] ml-1">(You)</span>
          )}
        </span>
      </div>
      {isMuted !== undefined && (
        <div className="ml-auto">
          {isMuted ? (
            <MicOff className="w-3.5 h-3.5 text-[#EF4444]" />
          ) : (
            <Mic className="w-3.5 h-3.5 text-[#555] opacity-0 group-hover:opacity-100" />
          )}
        </div>
      )}
    </div>
  );
}
