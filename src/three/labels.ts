import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';

// 한글 텍스트를 캔버스에 그려 텍스처로 만드는 헬퍼 — 폰트 파일 없이 시스템 폰트 사용.
// (로블록스판의 SurfaceGui TextLabel과 같은 방식)

const FONT = "'Jua', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif";

// Jua 웹폰트가 늦게 로드되면 텍스처를 다시 그리도록 준비 여부를 알려준다
export function useFontsReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (alive) setReady(true);
      });
    } else {
      setReady(true);
    }
    return () => {
      alive = false;
    };
  }, []);
  return ready;
}

function fitLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number, px: number): string[] | null {
  ctx.font = `${px}px ${FONT}`;
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const word of words) {
    const tryLine = cur ? cur + ' ' + word : word;
    if (ctx.measureText(tryLine).width <= maxW) {
      cur = tryLine;
    } else {
      if (cur) lines.push(cur);
      // 한 단어가 줄보다 길면 이 크기로는 못 넣음
      if (ctx.measureText(word).width > maxW) return null;
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines.length <= maxLines ? lines : null;
}

// 주어진 영역에 들어가도록 글자 크기를 줄여 가며 줄바꿈해서 그린다
function drawFitted(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  maxW: number,
  maxH: number,
  startPx: number,
  color: string,
  strokeColor?: string,
) {
  let px = startPx;
  let lines: string[] | null = null;
  while (px > 10) {
    const maxLines = Math.max(1, Math.floor(maxH / (px * 1.15)));
    lines = fitLines(ctx, text, maxW, maxLines, px);
    if (lines) break;
    px -= 2;
  }
  if (!lines) lines = [text];
  ctx.font = `${px}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lineH = px * 1.15;
  const y0 = cy - ((lines.length - 1) * lineH) / 2;
  lines.forEach((line, i) => {
    if (strokeColor) {
      ctx.lineWidth = Math.max(3, px * 0.14);
      ctx.strokeStyle = strokeColor;
      ctx.lineJoin = 'round';
      ctx.strokeText(line, cx, y0 + i * lineH);
    }
    ctx.fillStyle = color;
    ctx.fillText(line, cx, y0 + i * lineH);
  });
}

function toTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// 문에 붙는 답 텍스트 (투명 배경, 흰 글자 + 어두운 테두리)
export function useDoorTexture(answer: string): THREE.CanvasTexture {
  const fontsReady = useFontsReady();
  const tex = useMemo(() => {
    const w = 512;
    const h = 768;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, w, h);
    drawFitted(ctx, answer, w / 2, h * 0.42, w * 0.86, h * 0.5, 150, '#ffffff', '#2c1f52');
    // 문 손잡이
    ctx.beginPath();
    ctx.arc(w * 0.78, h * 0.72, 22, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd34d';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#b8860b';
    ctx.stroke();
    return toTexture(canvas);
    // fontsReady가 바뀌면 웹폰트로 다시 그린다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer, fontsReady]);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

// 문 위 문제판 (남색 배경 + 헤더 + 문제 텍스트)
export function useBoardTexture(header: string, question: string): THREE.CanvasTexture {
  const fontsReady = useFontsReady();
  const tex = useMemo(() => {
    const w = 1024;
    const h = 300;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    // 둥근 배경
    ctx.fillStyle = '#282c54';
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 28);
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#1a1d3d';
    ctx.stroke();
    // 헤더 (몇 번 문 · 학기)
    ctx.font = `34px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#9fb6ff';
    ctx.fillText(header, w / 2, 44);
    // 문제
    drawFitted(ctx, question, w / 2, h / 2 + 28, w * 0.92, h - 110, 72, '#ffffff');
    return toTexture(canvas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [header, question, fontsReady]);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

// 캐릭터 얼굴 (노란 피부에 눈 + 웃음)
export function makeFaceTexture(): THREE.CanvasTexture {
  const w = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = w;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffd34d';
  ctx.fillRect(0, 0, w, w);
  // 눈
  ctx.fillStyle = '#2c2c3e';
  ctx.beginPath();
  ctx.arc(w * 0.32, w * 0.42, 9, 0, Math.PI * 2);
  ctx.arc(w * 0.68, w * 0.42, 9, 0, Math.PI * 2);
  ctx.fill();
  // 웃는 입
  ctx.strokeStyle = '#2c2c3e';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(w * 0.5, w * 0.55, w * 0.18, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  // 볼터치
  ctx.fillStyle = 'rgba(255, 130, 130, 0.55)';
  ctx.beginPath();
  ctx.arc(w * 0.18, w * 0.6, 10, 0, Math.PI * 2);
  ctx.arc(w * 0.82, w * 0.6, 10, 0, Math.PI * 2);
  ctx.fill();
  return toTexture(canvas);
}
