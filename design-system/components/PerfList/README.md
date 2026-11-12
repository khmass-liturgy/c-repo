곡 모달 안에 있는 그 곡의 공연 이력이며, 새 날짜와 장소를 추가하는 줄이 있습니다.

`index.html`에서 손으로 옮긴 정적 CSS 클래스입니다. 공연마다 날짜와 장소를 넣습니다.

- 각 `perf-item`은 세리프 `gold` 날짜, `muted` 장소, hover 때 `red`가 되는 `perf-del` ×를 보여 줍니다.
- `add-perf`는 Calendar의 `date-trigger`, 장소용 `mini-input`, `btn-add`를 한 줄에 놓습니다.
- 추가할 때 날짜가 없으면 토스트로 알립니다: "날짜를 먼저 선택해주세요".
- 같은 공연이 Timeline 화면에서 모든 곡에 걸쳐 나옵니다.
