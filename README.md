# 두 문 러너 (Door Runner)

정답이 적힌 문을 몸으로 열며 끝없이 달리는 **3D 초등 수학 러너** 게임.
NAN 2026 (NHN Game × AI Hackathon) 사전과제 제출작입니다.

> ### 🎮 바로 플레이: https://hakhyun-kim.github.io/door-runner/
> 설치·로그인 없이 브라우저(모바일/PC)에서 바로 실행됩니다.
>
> 🎬 플레이 영상: _(YouTube 링크 추가 예정)_

## 게임 방법

- 초등 1학년 1학기 ~ 6학년 2학기 **전 학기 수학 240문제**. 첫 화면에서 학기를 고르면 시작.
- 캐릭터가 3D 트랙을 달리다 두 개의 문 앞에 도착하면 문제가 나타납니다. **정답이 적힌 문 쪽으로 걸어가 몸으로 문을 열면** 통과.
- 조작 — 모바일: 화면 왼쪽/오른쪽 꾹 누르기 · PC: `←`/`→` 또는 `A`/`D` (`↑`/`W`/스페이스는 앞으로)
- 첫 시도 정답만 ⭐ 적립. 오답이면 💥 정답을 알려주고 💖 1개 감소, 같은 문제 재도전. 💖 0개면 게임오버.

## 로컬 실행

```bash
npm install
npm run dev   # http://localhost:5174
```
요구 사항: Node.js 20+. `npm run build`로 프로덕션 빌드, `npm run typecheck`로 타입 검사.

## 문서 (해커톤 제출물)

- [게임 소개 및 설명](docs/hackathon/GAME_INTRO.md)
- [AI 활용 기술 문서](docs/hackathon/AI_USAGE.md)

## 기술 스택

React 18 · TypeScript · Vite · three.js · @react-three/fiber — 백엔드 없음(localStorage), 외부 에셋 없이 절차 생성 그래픽 + Web Audio 합성 사운드 (폰트: [Jua](https://fonts.google.com/specimen/Jua), SIL OFL 1.1).
