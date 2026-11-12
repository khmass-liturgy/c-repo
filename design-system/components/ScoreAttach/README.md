곡 모달의 악보 섹션입니다. 저장된 파일을 올리고, 열고, 지우며, 예전 공유 링크 입력란은 접힌 영역 안에 둡니다.

`index.html`에서 손으로 옮긴 정적 CSS 클래스입니다. 저장된 파일이 있으면 그 이름과 크기, 그리고 링크 값을 넣습니다.

- `score-file-row`에는 모양이 정해진 동작 셋이 있습니다: `score-file-label`(금색, 파일 선택), `score-file-open`(`info`, 열기), `score-file-delete`(중립). 파일 이름과 크기는 다음 줄 `score-file-meta`에 옵니다.
- `score-hint`는 제한을 한 줄로 알립니다: "비공개 저장 · PDF/JPG/PNG/WebP · 파일당 최대 20MB".
- `score-link-row`는 `score-link-input`과 `score-open-btn`을 짝짓습니다. 파일 동작이므로 포커스 테두리는 금색이 아니라 `info`입니다. 입력란이 비어 있으면 버튼에 `disabled`를 붙입니다.
- 링크 입력란은 `legacy-score-details` 안에 둡니다. 파일 올리기가 기본 경로입니다.
