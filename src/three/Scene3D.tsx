import { MutableRefObject, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { DoorQ } from '../doorQuestions';
import { makeFaceTexture, useBoardTexture, useDoorTexture } from './labels';

// 진짜 3D 러너 씬 (로블록스판의 트랙 구성을 three.js로 재현)
// 캐릭터가 +z 방향으로 달리고, 카메라가 뒤에서 따라간다.
// 카메라가 +z를 바라보므로 화면 왼쪽 = +x. 왼쪽 문(L)의 x는 +DOOR_X.

export type Phase = 'run' | 'ask' | 'pass' | 'crash' | 'over';
export interface Steer {
  side: Side | null; // 좌/우 (화면 꾹 누르기 또는 ←/→) — 누르면 그쪽 문을 향해 걷는다
  fwd: boolean; // 앞으로 (↑/W/스페이스) — 좌우 없이도 곧장 걷는다
}
export type Side = 'L' | 'R';

export interface GateData {
  q: DoorQ;
  correctLeft: boolean;
  opened?: Side; // 통과한 문 (열린 채로 남는다)
}

interface SceneProps {
  phase: Phase;
  gates: GateData[];
  gateNo: number; // 현재 도전 중인 문 번호 (1부터)
  picked: Side | null;
  course: string;
  runId: number; // 새 판 시작마다 +1 → 캐릭터/카메라 리셋
  onArrive: () => void; // 문 앞 도착 (run → ask)
  onPassed: () => void; // 문 통과 완료 (pass → 다음 run)
  onDoorTouch: (side: Side) => void; // 걸어가서 몸이 문에 닿음 (로블록스판의 Touched)
  steerRef: MutableRefObject<Steer>; // 지금 누르고 있는 조작 — 매 프레임 읽으므로 ref
}

// ── 트랙 치수 (로블록스판 비율) ──
const L = 38; // 문과 문 사이 거리
const TRACK_W = 22;
const DOOR_W = 7;
const DOOR_H = 11;
const WALL_H = 17;
const DOOR_X = 5.5;
const STOP_BACK = 11; // 문 앞 멈추는 거리
const RUN_SPEED = 20;
const WALK_SPEED = 9; // ask에서 문을 향해 걸어가는 앞 속도
const STEER_SPEED = 11; // ask에서 좌우로 걷는 속도
const TOUCH_DIST = 1.6; // 게이트 벽에 몸이 닿는 거리 (문 두께 절반 + 몸통)
const DOOR_HIT = DOOR_W / 2 + 0.6; // 문에 닿았다고 보는 x 범위 — 아이 조작이라 넉넉하게
const CAM_BACK = 13.5;
const CAM_H = 8.6;
const SIDE_X: Record<Side, number> = { L: DOOR_X, R: -DOOR_X };

// ── 색 (로블록스판과 동일) ──
const SKY = '#8ecbff';
const FLOOR_A = '#ffd68c';
const FLOOR_B = '#b7e1ff';
const COL_WALL = '#61489b';
const COL_DOOR = new THREE.Color('#7c5cdc');
const COL_OK = new THREE.Color('#50c878');
const COL_BAD = new THREE.Color('#e64646');
const CONFETTI = ['#ffd34d', '#ff8fb3', '#7cffb0', '#8ecbff', '#ffffff'];

const TMP = new THREE.Vector3();

function rnd(seed: number) {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// ── 문 하나 ──
function Door({
  x,
  answer,
  opened,
  bam,
}: {
  x: number;
  answer: string;
  opened: boolean;
  bam: boolean;
}) {
  const tex = useDoorTexture(answer);
  const matRef = useRef<THREE.MeshLambertMaterial>(null);
  const labelRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((_, delta) => {
    const m = matRef.current;
    if (!m) return;
    const dt = Math.min(delta, 0.05);
    const target = opened ? COL_OK : bam ? COL_BAD : COL_DOOR;
    m.color.lerp(target, Math.min(1, dt * (bam ? 18 : 10)));
    const op = opened ? 0.3 : 1;
    m.opacity += (op - m.opacity) * Math.min(1, dt * 5);
    if (labelRef.current) labelRef.current.opacity = m.opacity;
  });

  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, DOOR_H / 2, 0]}>
        <boxGeometry args={[DOOR_W, DOOR_H, 1.2]} />
        <meshLambertMaterial ref={matRef} color={COL_DOOR} transparent />
      </mesh>
      {/* 답 텍스트 (문 앞면) */}
      <mesh position={[0, DOOR_H / 2, -0.72]} rotation-y={Math.PI}>
        <planeGeometry args={[DOOR_W * 0.95, DOOR_H * 0.95]} />
        <meshBasicMaterial ref={labelRef} map={tex} transparent />
      </mesh>
    </group>
  );
}

// ── 트랙 밖 장식 (나무·꽃·구름) — 구간 번호로 항상 같은 배치 ──
function Deco({ index }: { index: number }) {
  const items = useMemo(() => {
    const arr: { x: number; z: number; s: number; tree: boolean; hue: number }[] = [];
    for (let k = 0; k < 6; k++) {
      const r1 = rnd(index * 17 + k * 3.1);
      const r2 = rnd(index * 17 + k * 3.1 + 1.3);
      const r3 = rnd(index * 17 + k * 3.1 + 2.6);
      const side = k % 2 === 0 ? 1 : -1;
      arr.push({ x: side * (16 + r1 * 18), z: r2 * L, s: 0.8 + r3 * 0.7, tree: r3 > 0.3, hue: r1 });
    }
    return arr;
  }, [index]);
  const clouds = useMemo(
    () =>
      [0, 1].map((k) => ({
        x: (k === 0 ? 1 : -1) * (12 + rnd(index * 7 + k) * 30),
        y: 22 + rnd(index * 7 + k + 0.4) * 10,
        z: rnd(index * 7 + k + 0.8) * L,
        s: 1.4 + rnd(index * 7 + k + 1.2) * 1.6,
      })),
    [index],
  );
  return (
    <group>
      {items.map((it, i) =>
        it.tree ? (
          <group key={i} position={[it.x, 0, it.z]} scale={it.s}>
            <mesh position={[0, 1, 0]}>
              <cylinderGeometry args={[0.45, 0.55, 2, 8]} />
              <meshLambertMaterial color="#8a5a2b" />
            </mesh>
            <mesh position={[0, 3.6, 0]}>
              <coneGeometry args={[2.3, 4.6, 8]} />
              <meshLambertMaterial color={it.hue > 0.5 ? '#3fae5c' : '#5cc36e'} />
            </mesh>
          </group>
        ) : (
          <group key={i} position={[it.x, 0, it.z]} scale={it.s}>
            <mesh position={[0, 0.5, 0]}>
              <cylinderGeometry args={[0.08, 0.1, 1, 6]} />
              <meshLambertMaterial color="#4f9e58" />
            </mesh>
            <mesh position={[0, 1.15, 0]}>
              <sphereGeometry args={[0.42, 10, 8]} />
              <meshLambertMaterial color={it.hue > 0.5 ? '#ff8fb3' : '#ffd34d'} />
            </mesh>
          </group>
        ),
      )}
      {clouds.map((c, i) => (
        <group key={`c${i}`} position={[c.x, c.y, c.z]} scale={c.s}>
          <mesh>
            <sphereGeometry args={[1.6, 12, 10]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[1.5, -0.2, 0.2]}>
            <sphereGeometry args={[1.1, 12, 10]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[-1.4, -0.3, -0.1]}>
            <sphereGeometry args={[1.2, 12, 10]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ── 트랙 한 구간: 바닥 + 유리 옆벽 + 게이트(벽·문 2개·문제판) ──
function Section({
  index,
  gate,
  course,
  bamSide,
}: {
  index: number;
  gate: GateData;
  course: string;
  bamSide: Side | null;
}) {
  const z0 = (index - 1) * L;
  const boardTex = useBoardTexture(`${index}번 문 · ${course}`, gate.q.q);
  const leftText = gate.correctLeft ? gate.q.a : gate.q.w;
  const rightText = gate.correctLeft ? gate.q.w : gate.q.a;

  // 게이트 벽 조각: [폭, 높이, x, y]
  const pieces: [number, number, number, number][] = [
    [2, DOOR_H, -10, DOOR_H / 2],
    [4, DOOR_H, 0, DOOR_H / 2],
    [2, DOOR_H, 10, DOOR_H / 2],
    [TRACK_W, WALL_H - DOOR_H, 0, DOOR_H + (WALL_H - DOOR_H) / 2],
  ];

  return (
    <group position={[0, 0, z0]}>
      {/* 바닥 (구간마다 색이 번갈아) */}
      <mesh position={[0, -0.5, L / 2]}>
        <boxGeometry args={[TRACK_W + 4, 1, L]} />
        <meshLambertMaterial color={index % 2 === 0 ? FLOOR_A : FLOOR_B} />
      </mesh>
      {/* 유리 옆벽 */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (TRACK_W / 2 + 0.5), 4.5, L / 2]}>
          <boxGeometry args={[1, 9, L]} />
          <meshLambertMaterial color="#a8d4ff" transparent opacity={0.3} />
        </mesh>
      ))}
      {/* 게이트 */}
      <group position={[0, 0, L]}>
        {pieces.map(([w, h, x, y], i) => (
          <mesh key={i} position={[x, y, 0]}>
            <boxGeometry args={[w, h, 2]} />
            <meshLambertMaterial color={COL_WALL} />
          </mesh>
        ))}
        {/* 문제판 */}
        <mesh position={[0, DOOR_H + (WALL_H - DOOR_H) / 2, -1.8]}>
          <boxGeometry args={[20, 5.5, 1]} />
          <meshLambertMaterial color="#282c54" />
        </mesh>
        <mesh position={[0, DOOR_H + (WALL_H - DOOR_H) / 2, -2.36]} rotation-y={Math.PI}>
          <planeGeometry args={[19.6, 5.4]} />
          <meshBasicMaterial map={boardTex} transparent />
        </mesh>
        <Door x={SIDE_X.L} answer={leftText} opened={gate.opened === 'L'} bam={bamSide === 'L'} />
        <Door x={SIDE_X.R} answer={rightText} opened={gate.opened === 'R'} bam={bamSide === 'R'} />
      </group>
      <Deco index={index} />
    </group>
  );
}

// ── 블록 캐릭터 (로블록스 느낌) ──
const SKIN = '#ffd34d';
const HAIR = '#7a4a21';
const SHIRT = '#35b8e0';
const PANTS = '#57c46a';
const BAG = '#ff8fb3';

interface RunnerRefs {
  charRef: React.RefObject<THREE.Group>;
  visRef: React.RefObject<THREE.Group>;
  legL: React.RefObject<THREE.Group>;
  legR: React.RefObject<THREE.Group>;
  armL: React.RefObject<THREE.Group>;
  armR: React.RefObject<THREE.Group>;
}

function Runner({ charRef, visRef, legL, legR, armL, armR }: RunnerRefs) {
  const face = useMemo(() => makeFaceTexture(), []);
  useEffect(() => () => face.dispose(), [face]);
  return (
    <group ref={charRef}>
      {/* 그림자 */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.05, 0]}>
        <circleGeometry args={[1.25, 24]} />
        <meshBasicMaterial color="#1e1433" transparent opacity={0.22} />
      </mesh>
      <group ref={visRef}>
        {/* 다리 */}
        <group ref={legL} position={[0.45, 1.7, 0]}>
          <mesh position={[0, -0.85, 0]}>
            <boxGeometry args={[0.6, 1.7, 0.65]} />
            <meshLambertMaterial color={PANTS} />
          </mesh>
        </group>
        <group ref={legR} position={[-0.45, 1.7, 0]}>
          <mesh position={[0, -0.85, 0]}>
            <boxGeometry args={[0.6, 1.7, 0.65]} />
            <meshLambertMaterial color={PANTS} />
          </mesh>
        </group>
        {/* 몸통 */}
        <mesh position={[0, 2.6, 0]}>
          <boxGeometry args={[1.8, 1.9, 1]} />
          <meshLambertMaterial color={SHIRT} />
        </mesh>
        {/* 가방 (카메라가 늘 등을 본다) */}
        <mesh position={[0, 2.7, -0.75]}>
          <boxGeometry args={[1.15, 1.35, 0.5]} />
          <meshLambertMaterial color={BAG} />
        </mesh>
        {/* 팔 */}
        <group ref={armL} position={[1.13, 3.35, 0]}>
          <mesh position={[0, -0.8, 0]}>
            <boxGeometry args={[0.5, 1.6, 0.6]} />
            <meshLambertMaterial color={SKIN} />
          </mesh>
        </group>
        <group ref={armR} position={[-1.13, 3.35, 0]}>
          <mesh position={[0, -0.8, 0]}>
            <boxGeometry args={[0.5, 1.6, 0.6]} />
            <meshLambertMaterial color={SKIN} />
          </mesh>
        </group>
        {/* 머리 (+z 면이 얼굴) */}
        <mesh position={[0, 4.25, 0]}>
          <boxGeometry args={[1.3, 1.25, 1.3]} />
          {Array.from({ length: 6 }, (_, i) =>
            i === 4 ? (
              <meshBasicMaterial key={i} attach={`material-${i}`} map={face} />
            ) : (
              <meshLambertMaterial key={i} attach={`material-${i}`} color={SKIN} />
            ),
          )}
        </mesh>
        {/* 머리카락 */}
        <mesh position={[0, 4.8, 0]}>
          <boxGeometry args={[1.42, 0.5, 1.42]} />
          <meshLambertMaterial color={HAIR} />
        </mesh>
        <mesh position={[0, 4.35, -0.68]}>
          <boxGeometry args={[1.42, 1.3, 0.12]} />
          <meshLambertMaterial color={HAIR} />
        </mesh>
      </group>
    </group>
  );
}

// ── 정답 통과 폭죽 ──
function Burst({ position }: { position: [number, number, number] }) {
  const parts = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        dir: new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.7 + 0.35, (Math.random() - 0.5) * 0.6)
          .normalize()
          .multiplyScalar(8 + Math.random() * 7),
        color: CONFETTI[i % CONFETTI.length],
        rot: Math.random() * Math.PI,
      })),
    [],
  );
  const group = useRef<THREE.Group>(null);
  const life = useRef(0);
  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(delta, 0.05);
    life.current += dt;
    g.children.forEach((m, i) => {
      const p = parts[i];
      m.position.addScaledVector(p.dir, dt);
      p.dir.y -= 20 * dt;
      m.rotation.x += dt * 6;
      m.rotation.z += dt * 7;
      m.scale.setScalar(Math.max(0.001, 1 - life.current / 0.9));
    });
    g.visible = life.current < 0.9;
  });
  return (
    <group ref={group} position={position}>
      {parts.map((p, i) => (
        <mesh key={i} rotation-z={p.rot}>
          <boxGeometry args={[0.45, 0.45, 0.1]} />
          <meshBasicMaterial color={p.color} />
        </mesh>
      ))}
    </group>
  );
}

// ── 월드: 캐릭터 이동 + 카메라 + 구간 관리 ──
function World({ phase, gates, gateNo, picked, course, runId, onArrive, onPassed, onDoorTouch, steerRef }: SceneProps) {
  const charRef = useRef<THREE.Group>(null);
  const visRef = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const groundRef = useRef<THREE.Mesh>(null);
  const runT = useRef(0);
  const notified = useRef(false);
  const prevPhase = useRef<Phase>('run');
  const crashT = useRef(-10);
  const lastRunId = useRef(-1);

  useEffect(() => {
    notified.current = false;
  }, [phase, gateNo]);

  useFrame((state, delta) => {
    const ch = charRef.current;
    const vis = visRef.current;
    if (!ch || !vis) return;
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    // 새 판(또는 첫 프레임): 이동 판정보다 먼저 캐릭터·카메라를 출발점으로
    if (lastRunId.current !== runId) {
      lastRunId.current = runId;
      ch.position.set(0, 0, -6);
      state.camera.position.set(0, CAM_H, -6 - CAM_BACK);
      runT.current = 0;
    }
    if (phase !== prevPhase.current) {
      if (phase === 'crash') crashT.current = t;
      prevPhase.current = phase;
    }

    // 이동
    const gz = gateNo * L;
    const steer = steerRef.current;
    let moving = false;
    if (phase === 'run' || phase === 'pass') {
      // 자동 달리기 (run: 문 앞까지, pass: 열린 문을 지나 다음 구간으로)
      const targetZ = phase === 'run' ? gz - STOP_BACK : gz + 7;
      const targetX = phase === 'pass' && picked ? SIDE_X[picked] : steer.side ? SIDE_X[steer.side] : 0;
      const dz = targetZ - ch.position.z;
      const step = RUN_SPEED * dt;
      if (dz <= step) {
        ch.position.z = targetZ;
        if (!notified.current) {
          notified.current = true;
          if (phase === 'run') onArrive();
          else onPassed();
        }
      } else {
        ch.position.z += step;
        moving = true;
      }
      ch.position.x += (targetX - ch.position.x) * Math.min(1, dt * 6);
    } else if (phase === 'ask') {
      // 로블록스판처럼 몸으로 문 열기: 좌/우를 누르면 그쪽 문을 향해, ↑(앞으로)만 누르면 곧장 걸어간다
      if (steer.side || steer.fwd) {
        moving = true;
        if (steer.side) {
          const dx = SIDE_X[steer.side] - ch.position.x;
          const stepX = STEER_SPEED * dt;
          ch.position.x += Math.abs(dx) <= stepX ? dx : Math.sign(dx) * stepX;
        }
        const wallZ = gz - TOUCH_DIST;
        ch.position.z = Math.min(ch.position.z + WALK_SPEED * dt, wallZ);
        if (ch.position.z >= wallZ - 0.001 && !notified.current) {
          // 문 폭 안이면 문에 닿은 것 — 벽 앞이면 막혀서 더 못 간다
          const x = ch.position.x;
          const side: Side | null =
            Math.abs(x - SIDE_X.L) <= DOOR_HIT ? 'L' : Math.abs(x - SIDE_X.R) <= DOOR_HIT ? 'R' : null;
          if (side) {
            notified.current = true;
            onDoorTouch(side);
          }
        }
      }
    } else {
      // crash: 뒤로 밀려나며 가운데로 돌아온다 (over는 그 자리에)
      if (phase === 'crash') {
        ch.position.z += (gz - STOP_BACK - 4 - ch.position.z) * Math.min(1, dt * 5);
      }
      ch.position.x += (0 - ch.position.x) * Math.min(1, dt * 6);
    }

    // 팔다리 애니메이션
    let swing: number;
    if (moving) {
      runT.current += dt * 11;
      swing = Math.sin(runT.current) * 0.95;
    } else {
      swing = Math.sin(t * 2.4) * 0.12;
    }
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
    if (armL.current) armL.current.rotation.x = -swing * 0.85;
    if (armR.current) armR.current.rotation.x = swing * 0.85;
    vis.position.y = moving ? Math.abs(Math.sin(runT.current)) * 0.22 : Math.sin(t * 2.4) * 0.06;

    // 걸어가는 문 쪽으로 몸을 살짝 돌린다
    const face =
      phase === 'ask' && steer.side
        ? THREE.MathUtils.clamp((SIDE_X[steer.side] - ch.position.x) * 0.12, -0.55, 0.55)
        : 0;
    vis.rotation.y += (face - vis.rotation.y) * Math.min(1, dt * 8);

    // 쿵! 뒤로 넘어졌다 일어나기
    const ce = t - crashT.current;
    if (phase === 'crash') {
      const k = ce < 0.25 ? ce / 0.25 : ce < 0.9 ? 1 : Math.max(0, 1 - (ce - 0.9) / 0.4);
      vis.rotation.x = -k * 0.85;
    } else {
      vis.rotation.x += (0 - vis.rotation.x) * Math.min(1, dt * 10);
    }

    // 카메라: 3인칭 추적 + 화면 비율에 맞춰 시야각 보정 (세로 화면에서도 두 문이 다 보이게)
    const cam = state.camera as THREE.PerspectiveCamera;
    const aspect = state.size.width / state.size.height;
    const vf = THREE.MathUtils.clamp(
      (2 * Math.atan(Math.tan((58 * Math.PI) / 360) / aspect) * 180) / Math.PI,
      48,
      100,
    );
    if (Math.abs(cam.fov - vf) > 0.5) {
      cam.fov = vf;
      cam.updateProjectionMatrix();
    }
    TMP.set(ch.position.x * 0.45, CAM_H, ch.position.z - CAM_BACK);
    cam.position.lerp(TMP, 1 - Math.pow(0.0005, dt));
    if (phase === 'crash' && ce < 0.45) cam.position.x += Math.sin(ce * 55) * 0.35 * (1 - ce / 0.45);
    cam.lookAt(ch.position.x * 0.5, 5.3, ch.position.z + 14);

    // 풀밭이 캐릭터를 따라간다 (무한 트랙)
    if (groundRef.current) groundRef.current.position.z = ch.position.z + 60;

    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__dbg = {
        phase,
        gateNo,
        correctLeft: gates[gateNo - 1]?.correctLeft,
        charZ: ch.position.z.toFixed(1),
        camZ: cam.position.z.toFixed(1),
        camY: cam.position.y.toFixed(1),
        fov: cam.fov.toFixed(0),
        t: t.toFixed(1),
      };
    }
  });

  // 보이는 구간: 지나온 문 1개 + 현재 + 다음
  const visible: number[] = [];
  for (let i = Math.max(1, gateNo - 1); i <= Math.min(gates.length, gateNo + 1); i++) visible.push(i);

  return (
    <>
      {/* 풀밭 */}
      <mesh ref={groundRef} rotation-x={-Math.PI / 2} position={[0, -1.2, 60]}>
        <planeGeometry args={[400, 400]} />
        <meshLambertMaterial color="#8fdc9a" />
      </mesh>
      {/* 출발 발판 */}
      <mesh position={[0, -0.5, -8]}>
        <boxGeometry args={[TRACK_W + 4, 1, 16]} />
        <meshLambertMaterial color="#c9f2c9" />
      </mesh>
      {visible.map((i) => (
        <Section
          key={i}
          index={i}
          gate={gates[i - 1]}
          course={course}
          bamSide={i === gateNo && phase === 'crash' ? picked : null}
        />
      ))}
      <Runner charRef={charRef} visRef={visRef} legL={legL} legR={legR} armL={armL} armR={armR} />
      {phase === 'pass' && picked && (
        <Burst key={gateNo} position={[SIDE_X[picked], DOOR_H * 0.6, gateNo * L - 1.5]} />
      )}
    </>
  );
}

export function Scene3D(props: SceneProps) {
  // ResizeObserver가 첫 측정을 안 주는 환경(일부 웹뷰)에서도 캔버스가 컨테이너 크기를 잡게 한다
  useEffect(() => {
    window.dispatchEvent(new Event('resize'));
  }, []);
  return (
    <Canvas
      flat
      dpr={[1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      camera={{ fov: 70, near: 0.5, far: 240, position: [0, CAM_H, -20] }}
      style={{ touchAction: 'none' }}
    >
      <color attach="background" args={[SKY]} />
      <fog attach="fog" args={[SKY, 65, 165]} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[25, 45, -20]} intensity={1.1} />
      <World {...props} />
    </Canvas>
  );
}
