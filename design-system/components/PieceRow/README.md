레퍼토리 카테고리 하나입니다. 세리프 헤더, 곡 행 목록, 전체 연주 시간이 있는 푸터로 이루어집니다.

`index.html`에서 손으로 옮긴 정적 CSS 클래스입니다. 카테고리 이름·아이콘·곡 수와, 곡마다 제목, 작곡가, 연주 시간, 상태, 마지막 연주 문구를 넣습니다.

- `category-section`이 `category-header`, `piece-list`, `cat-duration-footer`를 감쌉니다.
- `piece-item`은 왼쪽에서 오른쪽으로 제목과 작곡가, 선택적인 `score-btn`, `piece-duration`, StatusBadge, `last-played` 순입니다.
- 악보가 연결된 곡의 `piece-title`에 `has-score`를 붙이면 `gold`가 되고 '악보' 칩이 붙습니다.
- 작곡가 이름은 `composer` 색의 기울인 세리프입니다. 600px 아래에서는 숨기고 제목이 한 줄을 차지합니다.
- 행은 `gold-line`으로 구분하고 hover 때 `gold-wash`로 물듭니다. 행에 카드 스타일을 더하지 않습니다.
- 헤더 끝에는 선택적인 `cat-setlist-badge`, 둥근 동작 버튼, `cat-chevron`이 옵니다. 섹션에 `collapsed`를 붙이면 접히고 화살표가 돌아갑니다.
- 각 행은 `reorder-controls`(`reorder-btn` 화살표 둘)로 시작하고, 오늘 연주를 기록하는 둥근 `record-btn`과 `piece-del-btn`으로 끝날 수 있습니다. 화살표와 삭제는 행에 hover하거나 포커스할 때만 보입니다.
- 끌어 옮기는 동안 행에 `dragging`이 붙고, 놓일 자리의 행에는 `drag-over-top` 또는 `drag-over-bottom`으로 금색 선이 보입니다.
- `memo-icon`은 메모가 있는 곡을 표시합니다.
