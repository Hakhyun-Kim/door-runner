import { useState } from 'react';
import { DoorRunner } from './DoorRunner';
import { Course, GRADES } from './doorQuestions';
import { isMuted, setMuted } from './lib/sound';
import { useLocalStorage } from './lib/store';

export default function App() {
  const [course, setCourse] = useLocalStorage<Course | ''>('dr-course', '');
  const [stars, setStars] = useLocalStorage('dr-stars', 0);
  const [muted, setMutedUI] = useState(isMuted());
  const [picking, setPicking] = useState(false);

  function toggleMute() {
    setMuted(!muted);
    setMutedUI(!muted);
  }

  function pick(c: Course) {
    setCourse(c);
    setPicking(false);
  }

  // 첫 실행(또는 학기 바꾸기): 학기 선택 화면
  if (!course || picking) {
    return (
      <div className="app">
        <header className="header">
          <h1 className="logo">두 문 러너 🚪</h1>
        </header>
        <main className="picker">
          <p className="picker-title">몇 학년 문제로 달릴까요?</p>
          <p className="picker-sub">언제든 위의 학기 버튼으로 바꿀 수 있어요</p>
          <div className="grade-grid">
            {GRADES.map((g) => (
              <div key={g} className="grade-cell">
                <div className="grade-name">{g}학년</div>
                <div className="grade-btns">
                  <button className="btn primary" onClick={() => pick(`${g}-1` as Course)}>
                    1학기
                  </button>
                  <button className="btn mint" onClick={() => pick(`${g}-2` as Course)}>
                    2학기
                  </button>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <h1 className="logo">두 문 러너 🚪</h1>
        <button className="course-chip" onClick={() => setPicking(true)} aria-label="학기 바꾸기">
          {course}
        </button>
        <button className="sound-btn" onClick={toggleMute} aria-label="효과음 켜기/끄기">
          {muted ? '🔇' : '🔊'}
        </button>
        <div className="stars" key={stars}>
          ⭐ {stars}
        </div>
      </header>
      <DoorRunner key={course} course={course as Course} onStar={(n) => setStars((s) => s + n)} />
    </div>
  );
}
