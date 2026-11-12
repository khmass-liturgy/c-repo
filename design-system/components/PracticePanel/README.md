오늘의 연습 화면의 그릇입니다. 시간이 붙은 단계 목록과 진행선이 있는 제목 패널, 그리고 짝이 되는 타이머 카드입니다.

`index.html`에서 손으로 옮긴 정적 CSS 클래스입니다. 키커, 제목, 설명, 단계(분, 제목, 상세, 선택적인 곡 칩), 진행 폭(%)을 넣습니다.

- `practice-panel` 안에 `panel-head`, 3px `progress-shell`과 `progress-bar`, `practice-steps`가 차례로 옵니다.
- `practice-step`은 세 칸입니다: 세리프 `gold2`의 `step-time`, 글, `step-check`. `done`을 붙이면 행이 흐려지고 제목에 취소선이 그어지며 체크가 `green`으로 채워집니다.
- 연습할 곡 이름은 상세 줄 맨 앞의 `step-piece` 칩에 넣습니다.
- `timer-card`는 `timer-label`, 고정폭 세리프 숫자의 `timer-clock`, `timer-btn primary` 하나가 든 `timer-actions`를 가운데 정렬합니다.
- 패널은 1.55 대 0.75 격자에 `space-18` 간격으로 놓고 820px 아래에서 쌓습니다.
- `timer-tip`은 타이머 카드 아래의 짧은 `muted` 조언 문단이며 첫 구절을 `<strong>`으로 둡니다. `step-caution`은 단계 상세 안의 주의 줄입니다.
- 타이머 패널의 섹션 순서는 타이머 카드, 조언, Metronome, Tuner, Stopwatch, RotationBanner입니다.
