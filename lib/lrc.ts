export interface LrcLine {
  time: number;
  text: string;
}

export function parseLrc(lrc: string): LrcLine[] {
  return lrc
    .split('\n')
    .map((line) => {
      const m = line.match(/^\[(\d{1,2}):(\d{2})\.(\d{1,3})\](.*)$/);
      if (!m) return null;
      const time = parseInt(m[1]) * 60 + parseFloat(`${m[2]}.${m[3]}`);
      const text = m[4].trim();
      if (!text) return null;
      return { time, text };
    })
    .filter((l): l is LrcLine => l !== null);
}
