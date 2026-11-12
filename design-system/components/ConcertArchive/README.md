끝난 연주회의 기록입니다. 연주회마다 접히는 항목으로, 보관할 때의 순서·멘트·시간을 보여 줍니다.

`index.html`에서 손으로 옮긴 정적 CSS 클래스입니다. 보관된 연주회마다 이름, 일정 줄, 보관일, 그리고 곡과 곡 전 멘트를 넣습니다.

- `concert-archives`는 준비 중인 연주회 아래에 `border` 선으로 나뉘어 놓이며, 제목에 개수가 있고 도움말 문단이 하나 있습니다.
- 각 항목은 `<details class="concert-plan concert-archive">`입니다. `<summary>`는 연주회 이름과 `gold` `concert-archive-summary` 줄(날짜 · 시간 · 장소, 없으면 "일정 미입력")입니다.
- 안에서는 `concert-archive-step`마다 멘트와 그 길이, 이어서 `gold` 제목의 곡과 연주 시간을 보여 줍니다.
- 보관된 항목은 읽기 전용입니다. 하나도 없으면 `concert-empty`를 보여 줍니다: "아직 보관한 연주회가 없습니다."
