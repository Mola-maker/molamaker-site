'use client';

// MikuRhythm — a 30-second catch-the-falling-notes game. Notes drop from the
// top; tap them before they hit the floor. When the music player's analyser
// tap is live (window.__molaAnalyser), spawns ride the actual beat onsets;
// otherwise a steady metronome carries it. Score ≥ 25 wins a painting
// (miku:paint), and the fairy cheers the result either way.
//
// Listens: miku:perform / miku:scene with the 'rhythm' scene action.
// Exit: Esc, ✕, or the 30-second timer.

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isSceneAction } from '@/lib/chat/miku-actions';

const GAME_MS = 30_000;
const WIN_SCORE = 25;
const NOTE_GLYPHS = ['♪', '♫', '♬', '♩'];
const NOTE_COLORS = ['#39c5bb', '#ff9fbe', '#ffd166', '#7ab8f5'];

interface Note {
  id: number;
  x: number;       // 0..1 viewport fraction
  born: number;
  fall: number;    // ms to cross the screen
  glyph: string;
  color: string;
}

export function MikuRhythm() {
  const [playing, setPlaying] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [left, setLeft] = useState(GAME_MS);
  const [finale, setFinale] = useState<null | { score: number; won: boolean }>(null);
  const idRef = useRef(0);
  const comboRef = useRef(0);
  const scoreRef = useRef(0);

  // open on the shared events
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const maybeOpen = (names: string[]) => {
      if (!reduced && names.includes('rhythm')) { setFinale(null); setPlaying(true); }
    };
    const onPerform = (e: Event) => {
      maybeOpen(((e as CustomEvent).detail?.actions ?? []) as string[]);
    };
    const onScene = (e: Event) => {
      const s = (e as CustomEvent).detail?.scene as string | undefined;
      if (s && isSceneAction(s)) maybeOpen([s]);
    };
    window.addEventListener('miku:perform', onPerform);
    window.addEventListener('miku:scene', onScene);
    return () => {
      window.removeEventListener('miku:perform', onPerform);
      window.removeEventListener('miku:scene', onScene);
    };
  }, []);

  const close = useCallback(() => {
    setPlaying(false);
    setNotes([]);
    setScore(0);
    setCombo(0);
    scoreRef.current = 0;
    comboRef.current = 0;
  }, []);

  // game loop: spawn (beat-synced when possible), expire, countdown
  useEffect(() => {
    if (!playing) return;
    const t0 = performance.now();
    let raf = 0;
    let lastSpawn = 0;
    let beatBuf: Uint8Array<ArrayBuffer> | null = null;
    let beatAvg = 0.12;

    const spawn = (now: number) => {
      lastSpawn = now;
      const note: Note = {
        id: idRef.current++,
        x: 0.08 + Math.random() * 0.84,
        born: now,
        fall: 2100 + Math.random() * 900,
        glyph: NOTE_GLYPHS[Math.floor(Math.random() * NOTE_GLYPHS.length)],
        color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)],
      };
      setNotes((ns) => (ns.length > 14 ? ns : [...ns, note]));
    };

    const frame = (now: number) => {
      const elapsed = now - t0;
      if (elapsed >= GAME_MS) {
        const finalScore = scoreRef.current;
        const won = finalScore >= WIN_SCORE;
        setFinale({ score: finalScore, won });
        setPlaying(false);
        setNotes([]);
        try {
          window.dispatchEvent(new CustomEvent('miku:perform', { detail: { actions: [won ? 'cheer' : 'wave'] } }));
          if (won) setTimeout(() => window.dispatchEvent(new CustomEvent('miku:paint')), 1400);
        } catch { /* ignore */ }
        return;
      }
      setLeft(GAME_MS - elapsed);

      // beat-synced spawning when the analyser is live; metronome otherwise
      const analyser = (window as Window & { __molaAnalyser?: AnalyserNode }).__molaAnalyser;
      if (analyser) {
        if (!beatBuf) beatBuf = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(beatBuf);
        let bass = 0;
        for (let i = 1; i <= 8; i++) bass += beatBuf[i];
        bass /= 8 * 255;
        beatAvg = beatAvg * 0.96 + bass * 0.04;
        if (bass > beatAvg * 1.3 && bass > 0.18 && now - lastSpawn > 260) spawn(now);
        if (now - lastSpawn > 1200) spawn(now);   // quiet passages still play
      } else if (now - lastSpawn > 650) {
        spawn(now);
      }

      // notes that reached the floor: drop them, break the combo
      setNotes((ns) => {
        const live = ns.filter((n) => now - n.born < n.fall);
        if (live.length !== ns.length && comboRef.current > 0) {
          comboRef.current = 0;
          setCombo(0);
        }
        return live;
      });

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
    };
  }, [playing, close]);

  const hit = useCallback((id: number) => {
    setNotes((ns) => ns.filter((n) => n.id !== id));
    comboRef.current += 1;
    scoreRef.current += 1;
    setCombo(comboRef.current);
    setScore(scoreRef.current);
  }, []);

  if (!playing && !finale) return null;

  return createPortal(
    <div className="mrhythm" role="application" aria-label="Rhythm game">
      {playing && (
        <>
          <div className="mstage-card" aria-hidden="true">
            <span className="mstage-card__ring" />
            <span className="mstage-card__flash" />
            <div className="mstage-card__word">
              {[...'节奏'].map((ch, i) => (
                <span key={i} className="mstage-card__ch" style={{ ['--ci' as string]: i }}>{ch}</span>
              ))}
            </div>
            <div className="mstage-card__sub">RHYTHM · 30s</div>
          </div>
          <div className="mrhythm__hud">
            <span className="mrhythm__score">★ {score}</span>
            {combo >= 3 && <span className="mrhythm__combo">{combo} combo!</span>}
            <span className="mrhythm__time">{Math.ceil(left / 1000)}s</span>
            <button type="button" className="mrhythm__quit" onClick={close} aria-label="Quit">×</button>
          </div>
          <div className="mrhythm__floor" aria-hidden="true" />
          {notes.map((n) => (
            <button
              key={n.id}
              type="button"
              className="mrhythm__note"
              style={{
                left: `${(n.x * 100).toFixed(2)}%`,
                color: n.color,
                borderColor: n.color,
                animationDuration: `${n.fall}ms`,
              }}
              onPointerDown={() => hit(n.id)}
              aria-label="note"
            >{n.glyph}</button>
          ))}
          <div className="mrhythm__hint">点击落下的音符! · Esc 退出</div>
        </>
      )}
      {finale && (
        <div className="mrhythm__finale" onClick={() => setFinale(null)}>
          <div className="mrhythm__card">
            <div className="mrhythm__big">{finale.won ? '🎉 PERFECT LIVE!' : '♪ nice try~'}</div>
            <div className="mrhythm__final-score">★ {finale.score}</div>
            <p>{finale.won ? 'Miku 正在为你画一幅画…' : `${WIN_SCORE} 分可以赢得一幅画 — 再来一次?`}</p>
            <div className="mrhythm__finale-actions">
              {!finale.won && (
                <button type="button" onClick={(e) => { e.stopPropagation(); setFinale(null); setPlaying(true); }}>再来一局</button>
              )}
              <button type="button" onClick={(e) => { e.stopPropagation(); setFinale(null); }}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
