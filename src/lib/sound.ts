// Web Audio로 합성하는 효과음 — 파일 없이 가볍게.
// AudioContext는 반드시 사용자 입력(클릭) 안에서 생성/재개되어야 한다.

let ctx: AudioContext | undefined;

function ac(): AudioContext | null {
  try {
    if (typeof AudioContext === 'undefined') return null;
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export const isMuted = () => localStorage.getItem('dr-muted') === '1';
export const setMuted = (m: boolean) => localStorage.setItem('dr-muted', m ? '1' : '0');

function tone(
  c: AudioContext,
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType = 'triangle',
  vol = 0.12,
) {
  const t0 = c.currentTime + start;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

// 정답: 밝은 상승 아르페지오 (도-미-솔-도)
export function playCorrect() {
  if (isMuted()) return;
  const c = ac();
  if (!c) return;
  tone(c, 523.25, 0, 0.16);
  tone(c, 659.25, 0.09, 0.16);
  tone(c, 783.99, 0.18, 0.16);
  tone(c, 1046.5, 0.27, 0.28, 'triangle', 0.14);
}

// 오답: 낮게 두 번 "뿌-붑" (기죽지 않게 부드럽게)
export function playWrong() {
  if (isMuted()) return;
  const c = ac();
  if (!c) return;
  tone(c, 220, 0, 0.18, 'sine', 0.1);
  tone(c, 174.61, 0.16, 0.24, 'sine', 0.1);
}

// 보너스(연속 정답 등): 반짝이는 소리
export function playSparkle() {
  if (isMuted()) return;
  const c = ac();
  if (!c) return;
  tone(c, 1318.5, 0, 0.1, 'sine', 0.08);
  tone(c, 1567.98, 0.08, 0.1, 'sine', 0.08);
  tone(c, 2093, 0.16, 0.22, 'sine', 0.08);
}
