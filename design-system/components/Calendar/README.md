작은 월 달력을 여는 세리프 날짜 버튼입니다.

`index.html`에서 손으로 옮긴 정적 CSS 클래스입니다. `dt-val`에 선택된 날짜 글자를, 그리고 그 달의 날짜 칸을 넣습니다. 달 이동은 페이지의 스크립트가 처리합니다.

- `date-trigger`는 날짜를 `YYYY.MM.DD` 세리프로 보여 줍니다. 팝업이 열려 있는 동안 `open`을 붙입니다.
- `cal-popup`은 248px 폭, `raised` 바탕에 `shadow-popup`이며 버튼 아래에 놓입니다. `open`으로 켜고 끕니다.
- 주는 일요일부터 시작합니다. 일요일은 `sun`으로 빨간색, 오늘은 `today`로 `amber`, 고른 날은 `selected`로 `gold` 채움입니다.
- 그 달이 아닌 날은 `other-month`이며 고를 수 없습니다.
- `cal-today-btn`(오늘)은 오늘로 이동합니다.
