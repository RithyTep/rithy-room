'use client';

import { useState, useEffect, useRef } from 'react';
import { Image, Search, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
}

interface GiphyGif {
  id: string;
  images: {
    fixed_height: {
      url: string;
      width: string;
      height: string;
    };
    original: {
      url: string;
    };
  };
  title: string;
}

const GIPHY_API_KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY || '';

export function GifPicker({ onSelect }: GifPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [gifs, setGifs] = useState<GiphyGif[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Fetch trending GIFs on open
  useEffect(() => {
    if (isOpen && gifs.length === 0 && !search) {
      fetchTrending();
    }
  }, [isOpen]);

  // Search with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!search.trim()) {
      fetchTrending();
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchGifs(search);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [search]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const fetchTrending = async () => {
    if (!GIPHY_API_KEY) {
      setError('GIPHY API key not configured');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=20&rating=g`
      );
      const data = await res.json();
      setGifs(data.data || []);
    } catch (err) {
      setError('Failed to load GIFs');
    } finally {
      setIsLoading(false);
    }
  };

  const searchGifs = async (query: string) => {
    if (!GIPHY_API_KEY) {
      setError('GIPHY API key not configured');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=20&rating=g`
      );
      const data = await res.json();
      setGifs(data.data || []);
    } catch (err) {
      setError('Failed to search GIFs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (gif: GiphyGif) => {
    onSelect(gif.images.original.url);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className="relative" ref={pickerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-[#555] hover:text-[#DDD] rounded-lg transition-colors"
        title="Send GIF"
      >
        <Image className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-80 bg-[#1C1C1E] border border-[#242426] rounded-xl shadow-xl overflow-hidden z-50">
          {/* Header */}
          <div className="p-3 border-b border-[#242426]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search GIFs..."
                className="w-full bg-[#161618] border border-[#2A2A2A] rounded-lg pl-9 pr-8 py-2 text-[13px] text-white placeholder-[#555] focus:outline-none focus:border-[#444]"
                autoFocus
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#555] hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* GIF Grid */}
          <div className="h-72 overflow-y-auto p-2">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 text-[#6E56CF] animate-spin" />
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full text-[13px] text-[#EF4444]">
                {error}
              </div>
            ) : gifs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-[13px] text-[#555]">
                No GIFs found
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {gifs.map((gif) => (
                  <button
                    key={gif.id}
                    type="button"
                    onClick={() => handleSelect(gif)}
                    className="relative aspect-video rounded-lg overflow-hidden hover:ring-2 hover:ring-[#6E56CF] transition-all"
                  >
                    <img
                      src={gif.images.fixed_height.url}
                      alt={gif.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* GIPHY Attribution */}
          <div className="p-2 border-t border-[#242426] flex justify-center">
            <img
              src="https://giphy.com/static/img/poweredby_giphy.png"
              alt="Powered by GIPHY"
              className="h-4 opacity-60"
            />
          </div>
        </div>
      )}
    </div>
  );
}
