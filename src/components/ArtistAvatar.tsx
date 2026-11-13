import React, { useState } from 'react';
import { ArtistProfile } from '../types/music';

interface ArtistAvatarProps {
  artist: Pick<ArtistProfile, 'name' | 'avatarUrl' | 'isDefaultAvatar'>;
  sizeClass?: string;
  textSizeClass?: string;
  className?: string;
}

const AVATAR_GRADIENTS = [
  'from-[#f47b64] via-[#c4513d] to-[#1e3264]',
  'from-[#3b82f6] via-[#1e3264] to-[#0d142c]',
  'from-[#9e3b52] via-[#503750] to-[#141d3d]',
  'from-[#1b4965] via-[#26547c] to-[#0d142c]',
  'from-[#7b2cbf] via-[#3d2c6d] to-[#141d3d]',
  'from-[#e06d53] via-[#7c2d3b] to-[#141d3d]',
];

function getInitials(name: string): string {
  const words = (name || 'S').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'S';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

function getGradient(name: string): string {
  let sum = 0;
  for (let i = 0; i < name.length; i++) {
    sum = (sum + name.charCodeAt(i) * (i + 1)) % AVATAR_GRADIENTS.length;
  }
  return AVATAR_GRADIENTS[sum];
}

export const ArtistAvatar: React.FC<ArtistAvatarProps> = ({
  artist,
  sizeClass = 'w-14 h-14',
  textSizeClass = 'text-base',
  className = '',
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  const showImage =
    Boolean(artist.avatarUrl) && !artist.isDefaultAvatar && !imgFailed;

  if (showImage) {
    return (
      <div
        className={`${sizeClass} rounded-full overflow-hidden bg-[#162047] shrink-0 shadow-lg ${className}`}
      >
        <img
          src={artist.avatarUrl}
          alt={artist.name}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      aria-label={artist.name}
      className={`${sizeClass} rounded-full overflow-hidden bg-gradient-to-br ${getGradient(
        artist.name
      )} flex items-center justify-center shrink-0 shadow-lg ring-1 ring-white/15 select-none ${className}`}
    >
      <span className={`${textSizeClass} font-black tracking-tight text-[#f7f5f0]`}>
        {getInitials(artist.name)}
      </span>
    </div>
  );
};
