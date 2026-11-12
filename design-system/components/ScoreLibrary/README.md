올린 악보를 위한 두 칸 파일 탐색기입니다. 왼쪽에 카테고리, 오른쪽에 한 카테고리의 파일이 나옵니다.

`index.html`에서 손으로 옮긴 정적 CSS 클래스입니다. 카테고리 목록과 선택된 카테고리, 파일마다 이름·형식·크기를 넣습니다.

- `score-library-layout`은 180~240px 카테고리 칸과 유동 폭 패널입니다. 700px 아래에서는 카테고리 칸이 패널 위의 가로 스크롤 줄이 됩니다.
- `score-library-category` 행은 높이 44px이며 선택된 것에 `active`를 붙입니다.
- 각 `score-library-item`은 `item` 바탕에 파일 이름, `muted` 정보 줄, 동작을 둡니다.
- 파일 동작은 세 가지 모양입니다: `score-file-label`(금색, 올리기), `score-file-open`(`info`, 열기), `score-file-delete`(중립, 삭제).
- 파일이 없으면 `score-library-empty`를 보여 줍니다: "이 카테고리에 악보가 없습니다."
- 행 테두리는 `border`를 씁니다. 원본은 그에 가까운 값(#30373d)을 직접 씁니다.
