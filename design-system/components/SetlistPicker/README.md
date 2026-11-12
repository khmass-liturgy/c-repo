레퍼토리 곡 여러 개를 한 번에 고르는 모달입니다. 카테고리별로 묶여 있고 검색과 선택 개수가 있습니다.

`index.html`에서 손으로 옮긴 정적 CSS 클래스입니다. 카테고리별 곡(제목, 작곡가, 상태)과, 체크된 곡·이미 들어 있는 곡을 넣습니다.

- 520px 폭의 Modal입니다. 제목은 "곡 선택", 푸터는 취소, 추가 순입니다.
- `setlist-cat-label`이 각 `setlist-cat-group`의 머리에 작은 대문자 `muted`로 옵니다.
- `setlist-item`은 누를 수 있는 한 행입니다: `setlist-check`, 제목, 기울인 세리프 작곡가, 중립 `setlist-item-status` 알약. 여기서 상태 알약을 중립으로 둔 것은 의도입니다. 상태색은 레퍼토리 목록의 것입니다.
- 고른 행의 상자에 `checked`를 붙입니다: `gold` 채움에 `on-gold` 체크. 고를 수 없는 행에는 `already-in`을 붙여 40%로 흐리게 합니다.
- `setlist-selected-count`가 푸터 위에 개수를 `gold`로 알립니다.
