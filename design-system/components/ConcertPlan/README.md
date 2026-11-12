준비 중인 연주회입니다. 편집 가능한 이름, 날짜·시간·장소, 그리고 전체 길이가 나오는 연주 순서로 이루어집니다.

`index.html`에서 손으로 옮긴 정적 CSS 클래스입니다. 연주회 이름, 세 입력란, 연주 시간이 있는 곡 순서를 넣습니다. 요약 줄은 직접 계산해 넣습니다.

- `concert-topline`에는 화면 제목(`t-section`), 도움말 한 문장, 새로 만들기 버튼이 들어갑니다.
- `concert-plan`은 `border-strong` 외곽선의 `bg2` 카드입니다. 이름은 세리프 인라인 입력이고 오른쪽에 `gold` 요약이 옵니다.
- `concert-plan-grid`는 작은 입력란 셋입니다: 연주 날짜, 연주 시간, 연주 장소. 600px 아래에서 쌓입니다.
- 각 `concert-piece-row`는 세리프 `gold` 번호, 이름, 연주 시간, `concert-icon-btn` 셋(▲, ▼, ×)을 보여 줍니다.
- 곡이 없으면 `concert-empty`를 보여 줍니다: "위 목록에서 레퍼토리 곡을 골라 연주 순서대로 추가하세요."
- 곡 행 아래에 `concert-piece-ment` 블록을 둘 수 있습니다: "곡 전 멘트" 글상자와 좁은 "멘트 시간" 입력란. 멘트 시간은 전체 길이에 더해집니다.
- `concert-note`는 연주회 전체에 대한 멘트 글상자 하나입니다.
- `concert-plan-actions`가 카드를 마무리합니다. "완료 후 보관"은 준비 항목을 ConcertArchive로 옮기고, `concert-delete`는 빨간 외곽선의 삭제입니다.
- 곡 이름은 금색 밑줄의 `concert-piece-edit` 버튼으로 만들어 곡을 열게 할 수 있습니다.
