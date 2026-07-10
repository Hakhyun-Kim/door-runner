# 두 문 러너 (Door Runner) — 웹판 (NAN 2026 제출용)

정답이 적힌 문을 골라 끝없이 달리는 **3D** 초등 수학 러너 게임 (three.js + react-three-fiber). 모바일 우선 웹앱 (React + Vite + TypeScript).
초등 1학년 1학기 ~ 6학년 2학기 전 학기, 학기당 20문제 = 240문제.
**공개 저장소** — NAN 2026 (NHN Game × AI Hackathon) 사전과제 제출용. 시크릿·키·내부 경로 커밋 금지.

## 실행
- `npm install` — 최초 1회
- `npm run dev` — 개발 서버 (기본 포트 5174, `PORT` 환경변수로 변경 가능)
- `npm run typecheck` — 타입 검사
- `npm run build` — 프로덕션 빌드
- 숨김 탭(헤드리스 프리뷰)에서는 크롬이 rAF를 멈춰 3D가 안 그려짐 — `?rafshim` 쿼리로 우회 (index.html의 개발용 심).

## 해커톤 제출 (현재 최우선)
- 행사: https://nan2026.nhn.com/ · 심사 계정: dl_gameai_reviewer@nhn.com
- 플레이 URL: https://hakhyun-kim.github.io/door-runner/ — main 푸시 시 `.github/workflows/deploy-pages.yml`이 자동 배포 (vite `base: './'`)
- 제출물·체크리스트·영상 가이드: `docs/hackathon/SUBMISSION.md` (게임 소개 = `GAME_INTRO.md`, AI 활용 = `AI_USAGE.md` — 링크 확정 후 PDF 변환)
- 커밋 기록 유지 필수, 접수 마감 후 변경 불가. 심사 종료까지 저장소·배포 유지.

## 구조
- `src/doorQuestions.ts` — **문제 은행 240문제.** `{q: 문제, a: 정답, w: 오답}` 형식, `Course`('1-1'~'6-2') 키.
- `src/DoorRunner.tsx` — 게임 로직. phase 상태 머신: `run`(문까지 달려가기) → `ask`(화면 좌/우 꾹 누르기 또는 ←/→·A/D 키로 문까지 걸어가기, ↑·W·스페이스는 앞으로만 걷기) → `pass`(문 통과) / `crash`(💥 정답 표시, 💖-1, 같은 문제 재도전·문 좌우 재배치) → `over`(게임오버). 💖 3개. 문제 20개 소진 시 재셔플로 무한 진행. 정답 문 위치는 매번 무작위. run/pass의 끝은 타이머가 아니라 씬의 콜백(`onArrive`/`onPassed`/`onDoorTouch`)이 알림. HUD·팝업·게임오버·걷기 조작 영역(steer-zones)은 캔버스 위 DOM 오버레이. 오답 시 누름을 강제 해제해 연속 충돌 방지.
- `src/three/Scene3D.tsx` — **3D 씬** (r3f). 캐릭터가 +z로 달리고 카메라가 뒤에서 추적 (구간 38, 문 7×11, 보라 게이트, 유리 옆벽, 교대 바닥). ask에서는 누르는 방향의 문으로 걸어가 몸이 닿으면 판정(`onDoorTouch`) — 문 사이 벽은 막혀서 못 지나감. 화면 비율에 따라 FOV 자동 보정(세로 화면에서 두 문이 다 보이게). 카메라가 +z를 보므로 **화면 왼쪽 = +x** (SIDE_X 참고). 블록 캐릭터(달리기 팔다리 스윙·크래시 뒤로 넘어지기), 정답 폭죽, 나무·꽃·구름은 구간 번호 시드로 고정 배치. 새 판 리셋은 useFrame 안에서 runId 비교로 처리(이동 판정과의 순서 보장).
- `src/three/labels.ts` — 한글 텍스트 → 캔버스 → 텍스처 헬퍼 (폰트 파일 없이 Jua/시스템 폰트). 영역에 맞춰 자동 줄바꿈·축소. 문 답, 문제판, 캐릭터 얼굴.
- `src/App.tsx` — 학기 선택 화면(첫 실행/학기 변경) + 헤더(학기 칩, 음소거, ⭐) + 러너.
- `src/lib/sound.ts` — Web Audio 합성 효과음 (정답 아르페지오/오답 저음, 파일 없음).
- `src/lib/store.ts` — useLocalStorage 훅.
- localStorage 키: `dr-course`(학기), `dr-stars`(누적 별), `dr-best`(최고 기록), `dr-muted`(음소거). 모두 `dr-` 접두사.

## 게임 규칙
- 문제판을 읽고 정답 문 쪽 화면을 꾹 눌러(데스크톱은 ←/→ 키, ↑는 앞으로) 걸어가 몸으로 문을 열면 통과. **첫 시도 정답만** ⭐ 1개 적립.
- 오답 → 💥 정답을 알려주고 💖 1개 감소, 같은 문제 앞에서 재도전 (배움 강화 목적).
- 💖 0개 → 게임오버 (통과 수 + 최고 기록 표시) → 다시 달리기.

## 원칙
- UI 문구는 모두 한국어, 초등학생 눈높이. 오답이어도 기죽지 않는 부드러운 문구.
- 백엔드 없음. 모든 데이터는 localStorage.
- 문제는 한국 초등 수학 교육과정의 학기별 단원 범위 준수 (예: 2-2 곱셈구구, 4-1 각도·세자리×두자리, 6-2 분수÷분수·비례식).
- 외부 에셋 추가 시 `docs/hackathon/AI_USAGE.md`의 출처·라이선스 표에 반드시 반영.
