'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { LrcLine } from '@/lib/lrc';

type Song = {
  id: number;
  name: string;
  artists: Array<{ name: string }>;
};

type NowPlaying = {
  id: number;
  title: string;
  artist: string;
  url: string;
  cover?: string;
  album?: string;
  duration?: number;
  lyrics?: Array<{ time: number; text: string }>;
  recent?: string[];
  bpm?: number;
  key?: string;
  mood?: string;
};

export function MusicPlayer({ hideTrigger = false }: { hideTrigger?: boolean } = {}) {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Song[]>([]);
  const [searching, setSearching] = useState(false);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [volume, setVolume] = useState(0.6);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  // Ref so audio event listeners always see the current song without stale closure
  const nowPlayingRef = useRef<NowPlaying | null>(null);
  // Pending one-shot `canplay` listener — tracked so a rapid song switch can
  // detach the previous one instead of leaking handlers that fire late.
  const pendingCanPlayRef = useRef<(() => void) | null>(null);

  const clearPendingCanPlay = useCallback(() => {
    if (pendingCanPlayRef.current && audioRef.current) {
      audioRef.current.removeEventListener('canplay', pendingCanPlayRef.current);
    }
    pendingCanPlayRef.current = null;
  }, []);

  // Create audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume;

    const dispatchPlayState = (playing: boolean) => {
      const np = nowPlayingRef.current;
      if (np) window.dispatchEvent(new CustomEvent('mola:now-playing', {
        detail: {
          id: np.id,
          title: np.title,
          artist: np.artist,
          cover: np.cover ?? '',
          album: np.album ?? '',
          duration: np.duration ?? 0,
          lyrics: np.lyrics ?? [],
          recent: np.recent ?? [],
          bpm: np.bpm ?? 0,
          key: np.key ?? '—',
          mood: np.mood ?? '—',
          playing,
        },
      }));
    };
    audio.addEventListener('play',  () => { setPlaying(true);  dispatchPlayState(true);  });
    audio.addEventListener('pause', () => { setPlaying(false); dispatchPlayState(false); });
    audio.addEventListener('ended', () => { setPlaying(false); dispatchPlayState(false); });
    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
      window.dispatchEvent(new CustomEvent('mola:time-update', { detail: { time: audio.currentTime, duration: audio.duration || 0 } }));
    });
    audio.addEventListener('durationchange', () => setDuration(audio.duration || 0));
    audio.addEventListener('error', () => {
      setError('Playback failed — track may be restricted');
      setPlaying(false);
    });

    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Auto-preload current NetEase now-playing info (no autoplay — user must click ▶)
  useEffect(() => {
    fetch('/api/music/nowplaying')
      .then((r) => r.json())
      .then((json: { data?: { id: string; title: string; artist: string; album?: string; cover?: string; duration?: number; lyrics?: Array<{ time: number; text: string }>; recent?: string[] } | null }) => {
        const d = json.data;
        if (!d) return;
        // Use functional update to avoid stale closure — don't overwrite a song the user already picked
        setNowPlaying((current) => current ?? {
          id: Number(d.id),
          title: d.title,
          artist: d.artist,
          url: '',
          album: d.album,
          cover: d.cover,
          duration: d.duration,
          lyrics: d.lyrics,
          recent: d.recent,
        });
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Close panel on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/music/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      const songs: Song[] = data?.data?.songs ?? [];
      setResults(songs);
      if (songs.length === 0) setError('No results found');
    } catch {
      setError('Search failed');
    } finally {
      setSearching(false);
    }
  }, []);

  const playSong = useCallback((song: Song) => {
    setError(null);
    const { id, name, artists } = song;
    const artist = artists.map((a) => a.name).join(', ');

    const audio = audioRef.current!;
    audio.pause();
    clearPendingCanPlay();

    // Update ref + UI immediately with basic info
    const basicNowPlaying: NowPlaying = {
      id,
      title: name,
      artist,
      url: '',
      cover: '',
      album: '',
      duration: 0,
      lyrics: [],
      recent: [],
      bpm: 0,
      key: '—',
      mood: '—',
    };
    nowPlayingRef.current = basicNowPlaying;
    setNowPlaying(basicNowPlaying);
    setCurrentTime(0);
    setDuration(0);
    window.dispatchEvent(new CustomEvent('mola:now-playing', {
      detail: { id, title: name, artist, cover: '', album: '', duration: 0, lyrics: [], recent: [], bpm: 0, key: '—', mood: '—', playing: true },
    }));

    // Fetch full metadata in the background
    fetch('/api/music/nowplaying')
      .then((r) => r.json())
      .then((json) => {
        const d = json.data;
        if (d && Number(d.id) === id) {
          const enrichedNowPlaying: NowPlaying = {
            id,
            title: name,
            artist,
            url: '',
            album: d.album ?? '',
            cover: d.cover ?? '',
            duration: d.duration ?? 0,
            lyrics: d.lyrics ?? [],
            recent: d.recent ?? [],
            bpm: d.bpm ?? 0,
            key: d.key ?? '—',
            mood: d.mood ?? '—',
          };
          nowPlayingRef.current = enrichedNowPlaying;
          setNowPlaying(enrichedNowPlaying);
          window.dispatchEvent(new CustomEvent('mola:now-playing', {
            detail: {
              id,
              title: name,
              artist,
              cover: d.cover ?? '',
              album: d.album ?? '',
              duration: d.duration ?? 0,
              lyrics: d.lyrics ?? [],
              recent: d.recent ?? [],
              bpm: d.bpm ?? 0,
              key: d.key ?? '—',
              mood: d.mood ?? '—',
              playing: true,
            },
          }));
        }
      })
      .catch(() => {});

    audio.src = `/api/music/${id}`;
    audio.load();

    const startPlayback = () => {
      clearPendingCanPlay();
      audio.play().catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError('Playback blocked — track may be restricted');
        setPlaying(false);
      });
    };
    if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      startPlayback();
    } else {
      pendingCanPlayRef.current = startPlayback;
      audio.addEventListener('canplay', startPlayback);
    }
  }, [clearPendingCanPlay]);

  // Listen for play requests dispatched from the stream SONG card
  useEffect(() => {
    const handler = (e: Event) => {
      const { id, title, artist } = (e as CustomEvent<{ id: number; title: string; artist: string }>).detail;
      playSong({ id, name: title, artists: [{ name: artist }] });
    };
    window.addEventListener('mola:play-song', handler);
    return () => window.removeEventListener('mola:play-song', handler);
  }, [playSong]);

  // Allow the SONG card's vinyl button to pause without needing the player panel open
  useEffect(() => {
    const handler = () => { audioRef.current?.pause(); };
    window.addEventListener('mola:pause-song', handler);
    return () => window.removeEventListener('mola:pause-song', handler);
  }, []);

  // The MikuHub satellite toggles the panel (replaces the standalone button).
  useEffect(() => {
    const handler = () => setOpen((o) => !o);
    window.addEventListener('mola:music-toggle', handler);
    return () => window.removeEventListener('mola:music-toggle', handler);
  }, []);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio || !nowPlaying) return;
    if (audio.paused) {
      // If already buffered, play directly; otherwise wait for canplay
      const doPlay = () => {
        clearPendingCanPlay();
        audio.play().catch((err: unknown) => { if (!(err instanceof DOMException && err.name === 'AbortError')) setError('Playback blocked'); });
      };
      if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        doPlay();
      } else {
        pendingCanPlayRef.current = doPlay;
        audio.addEventListener('canplay', doPlay);
      }
    } else {
      audio.pause();
    }
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = Number(e.target.value);
    if (audioRef.current) audioRef.current.currentTime = t;
    setCurrentTime(t);
  };

  const fmt = (s: number) => {
    if (!isFinite(s)) return '--:--';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {/* Floating trigger button — hidden when the MikuHub owns the trigger. */}
      {!hideTrigger && (
        <button
          className={`music-btn${playing ? ' is-playing' : ''}`}
          onClick={() => setOpen((o) => !o)}
          aria-label="Music player"
          title="NetEase Music"
        >
          <span className={`music-btn__note${playing ? ' is-playing' : ''}`}>♪</span>
        </button>
      )}

      {/* Mini panel */}
      {open && (
        <div className="music-panel" ref={panelRef}>
          <div className="music-panel__head">
            <span className="music-panel__eyebrow">NetEase Music</span>
            <button className="music-panel__close" onClick={() => setOpen(false)} aria-label="Close">×</button>
          </div>

          {/* Now playing */}
          {nowPlaying ? (
            <div className="music-now">
              <div className="music-now__info">
                <div className="music-now__title">{nowPlaying.title}</div>
                <div className="music-now__artist">{nowPlaying.artist}</div>
              </div>
              <button
                className="music-now__play"
                onClick={togglePlayPause}
                aria-label={playing ? 'Pause' : 'Play'}
              >
                {playing ? '❙❙' : '▶'}
              </button>
              {/* Seek bar */}
              <div className="music-seek">
                <span className="music-seek__time">{fmt(currentTime)}</span>
                <input
                  type="range"
                  className="music-seek__bar"
                  min={0}
                  max={duration || 1}
                  step={0.5}
                  value={currentTime}
                  onChange={seek}
                />
                <span className="music-seek__time">{fmt(duration)}</span>
              </div>
            </div>
          ) : (
            <div className="music-empty">Search a song to begin</div>
          )}

          {error && <div className="music-error">{error}</div>}

          {/* Volume */}
          <div className="music-vol">
            <span className="music-vol__icon">🔈</span>
            <input
              type="range"
              className="music-seek__bar"
              min={0}
              max={1}
              step={0.02}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
            />
            <span className="music-vol__val">{Math.round(volume * 100)}%</span>
          </div>

          {/* Search */}
          <div className="music-search">
            <input
              className="music-search__input"
              type="text"
              placeholder="Search 网易云..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search(query)}
            />
            <button
              className="music-search__btn"
              onClick={() => search(query)}
              disabled={searching}
              aria-label="Search"
            >
              {searching ? '…' : '↵'}
            </button>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <ul className="music-results">
              {results.map((song) => (
                <li
                  key={song.id}
                  className={`music-results__item${nowPlaying?.id === song.id ? ' is-active' : ''}`}
                  onClick={() => playSong(song)}
                >
                  <span className="music-results__name">{song.name}</span>
                  <span className="music-results__artist">{song.artists.map((a) => a.name).join(', ')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
