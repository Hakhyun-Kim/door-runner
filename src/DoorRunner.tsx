import { useEffect, useRef, useState } from 'react';
import { Course, DOOR_QUESTIONS, DoorQ } from './doorQuestions';
import { playCorrect, playWrong } from './lib/sound';
import { useLocalStorage } from './lib/store';
import { GateData, Phase, Scene3D, Side, Steer } from './three/Scene3D';

// 두 문 러너 — 정답이 적힌 문까지 걸어가 몸으로 여는 3D 게임 (로블록스판과 같은 문제 세트·조작 감각)
// 흐름: run(달려가기) → ask(좌/우 꾹 눌러 문까지 걷기) → pass(통과) / crash(쿵, 💖-1) → … → over(게임 끝)
// 달려가기/통과의 끝은 타이머가 아니라 3D 씬의 콜백(onArrive/onPassed/onDoorTouch)이 알려준다.

const LIVES = 3;
const CRASH_MS = 1500;

function shuffled<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function DoorRunner({ course, onStar }: { course: Course; onStar: (n: number) => void }) {
  const bank = DOOR_QUESTIONS[course];
  const seq = useRef({ order: shuffled(bank.map((_, i) => i)), pos: -1 });
  const timers = useRef<number[]>([]);

  const nextQ = (): DoorQ => {
    seq.current.pos += 1;
    if (seq.current.pos >= seq.current.order.length) {
      seq.current.order = shuffled(bank.map((_, i) => i));
      seq.current.pos = 0;
    }
    return bank[seq.current.order[seq.current.pos]];
  };
  const makeGate = (q: DoorQ): GateData => ({ q, correctLeft: Math.random() < 0.5 });

  // gates[gateNo-1] = 현재 문. 다음 문까지 미리 만들어 두어 멀리 보이게 한다.
  const [gates, setGates] = useState<GateData[]>(() => [makeGate(nextQ()), makeGate(nextQ())]);
  const [gateNo, setGateNo] = useState(1);
  const [phase, setPhase] = useState<Phase>('run');
  const [picked, setPicked] = useState<Side | null>(null);
  const [lives, setLives] = useState(LIVES);
  const [passed, setPassed] = useState(0);
  const [firstTry, setFirstTry] = useState(true);
  const [runId, setRunId] = useState(0);
  const [best, setBest] = useLocalStorage('dr-best', 0);

  // 걷기 조작: 화면 좌/우 꾹 누르기 또는 ←/→(A/D) 키, ↑(W/스페이스)는 앞으로. 씬은 ref로 매 프레임 읽는다.
  const steerRef = useRef<Steer>({ side: null, fwd: false });
  const [steer, setSteerState] = useState<Side | null>(null); // ◀▶ 표시 하이라이트용
  const setSteer = (s: Side | null) => {
    steerRef.current = { ...steerRef.current, side: s };
    setSteerState(s);
  };
  const releaseSteer = (s: Side) => {
    if (steerRef.current.side === s) setSteer(null);
  };
  const setForward = (on: boolean) => {
    steerRef.current = { ...steerRef.current, fwd: on };
  };

  useEffect(() => {
    const keySide = (e: KeyboardEvent): Side | null =>
      e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A'
        ? 'L'
        : e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D'
          ? 'R'
          : null;
    const keyFwd = (e: KeyboardEvent) => e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ';
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return; // 오답 후 자동 재걷기 방지 — 다시 눌러야 걷는다
      const s = keySide(e);
      if (s) {
        e.preventDefault();
        setSteer(s);
      } else if (keyFwd(e)) {
        e.preventDefault();
        setForward(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      const s = keySide(e);
      if (s) releaseSteer(s);
      else if (keyFwd(e)) setForward(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const later = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const gate = gates[gateNo - 1];

  function choose(side: Side) {
    if (phase !== 'ask' || !gate) return;
    const ok = (side === 'L') === gate.correctLeft;
    setPicked(side);
    if (ok) {
      playCorrect();
      if (firstTry) onStar(1);
      const np = passed + 1;
      setPassed(np);
      if (np > best) setBest(np);
      setGates((gs) => gs.map((g, i) => (i === gateNo - 1 ? { ...g, opened: side } : g)));
      setPhase('pass');
    } else {
      playWrong();
      setSteer(null); // 꾹 누른 채 같은 문에 연달아 부딪히지 않게
      setForward(false);
      const remaining = lives - 1;
      setLives(remaining);
      setFirstTry(false);
      setPhase('crash');
      later(CRASH_MS, () => {
        if (remaining <= 0) {
          setPhase('over');
        } else {
          // 같은 문제 재도전 — 문 좌우는 다시 무작위
          setGates((gs) => gs.map((g, i) => (i === gateNo - 1 ? { ...g, correctLeft: Math.random() < 0.5 } : g)));
          setPicked(null);
          setPhase('ask');
        }
      });
    }
  }

  // 문 앞에 도착 → 문 고르기
  function handleArrive() {
    setPhase((p) => (p === 'run' ? 'ask' : p));
  }

  // 문을 지나감 → 다음 문으로 달리기 (멈추지 않고 이어 달린다)
  function handlePassed() {
    setGates((gs) => [...gs, makeGate(nextQ())]);
    setGateNo((n) => n + 1);
    setPicked(null);
    setFirstTry(true);
    setPhase('run');
  }

  function restart() {
    seq.current = { order: shuffled(bank.map((_, i) => i)), pos: -1 };
    setGates([makeGate(nextQ()), makeGate(nextQ())]);
    setGateNo(1);
    setLives(LIVES);
    setPassed(0);
    setPicked(null);
    setFirstTry(true);
    setRunId((r) => r + 1);
    setPhase('run');
  }

  return (
    <div className="module">
      <div className="runner-hud">
        <span aria-label="남은 목숨">
          {'💖'.repeat(lives)}
          {'🤍'.repeat(LIVES - lives)}
        </span>
        <span>🚪 {passed}개 통과</span>
        <span>🏆 최고 {best}</span>
      </div>

      <div className="runner-scene3d">
        <Scene3D
          phase={phase}
          gates={gates}
          gateNo={gateNo}
          picked={picked}
          course={course}
          runId={runId}
          onArrive={handleArrive}
          onPassed={handlePassed}
          onDoorTouch={choose}
          steerRef={steerRef}
        />
        {phase !== 'over' && (
          <div className="steer-zones">
            {(['L', 'R'] as Side[]).map((s) => (
              <div
                key={s}
                className={`steer-zone${steer === s ? ' active' : ''}`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  setSteer(s);
                }}
                onPointerUp={() => releaseSteer(s)}
                onPointerLeave={() => releaseSteer(s)}
                onPointerCancel={() => releaseSteer(s)}
              >
                <span>{s === 'L' ? '◀' : '▶'}</span>
              </div>
            ))}
          </div>
        )}
        {phase === 'pass' && <div className="runner-pop ok">⭐ 정답!</div>}
        {phase === 'crash' && gate && (
          <div className="runner-pop bad">
            💥 정답은 <b>{gate.q.a}</b>
          </div>
        )}
        {phase === 'over' && (
          <div className="runner-over">
            <div className="runner-over-title">🏁 오늘은 여기까지!</div>
            <p>
              문 <b>{passed}개</b>를 통과했어요
              {passed >= best && passed > 0 ? ' — 최고 기록! 🎉' : ''}
            </p>
            <button className="btn primary" onClick={restart}>
              다시 달리기 ▶
            </button>
          </div>
        )}
      </div>

      <p className="runner-hint">
        정답 문 쪽 화면을 꾹 누르면 걸어가요. 키보드는 ←/→로 문 쪽, ↑로 앞으로! 몸으로 문을 열면 통과, 틀리면 💖가
        하나 줄어요.
      </p>
    </div>
  );
}
