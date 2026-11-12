흐릿하고 어두운 덮개 위 가운데에 뜨는 대화 상자입니다. 곡을 편집할 때 쓰며, 삭제처럼 되돌릴 수 없는 동작에는 더 작은 확인 상자를 씁니다.

`index.html`에서 손으로 옮긴 정적 CSS 클래스입니다. 제목, 섹션(각각 `modal-label`과 컨트롤), 푸터 버튼을 넣습니다. 덮개에 `open`을 붙이면 보입니다.

- `modal-overlay` > `modal`: 최대 500px 폭, `bg2` 바탕에 `border-strong` 외곽선과 `shadow-modal`. 제목은 기울인 세리프 `gold`입니다.
- 각 `modal-section`은 대문자 `modal-label`로 시작합니다.
- `status-options` > `status-opt`는 네 가지 상태 선택기입니다. 고른 것에 `sel-암보`, `sel-연습중`, `sel-완성`, `sel-공연가능` 중 하나를 붙입니다.
- `modal-footer`는 왼쪽에 `btn-danger`, 오른쪽에 `btn-ghost`와 `btn-primary`를 차례로 둡니다.
- `confirm-overlay` > `confirm-box`는 질문 하나를 합니다. 곡이나 카테고리 이름을 `<strong>`에 넣으면 기울인 세리프 `gold`로 보입니다. 버튼은 취소, 삭제 순입니다.
- 덮개를 누르면 모달이 닫힙니다. 모달 둘을 겹치지 않습니다.
- 제목을 편집하게 하려면 `modal-title-edit` > `modal-title-input`(기울인 세리프 `gold`)을 쓰고, 이어서 `modal-composer-input`과 `modal-cat-label`을 둡니다. 작곡가 입력란은 `well`과 `border`를 쓰며, 원본은 여기에 따로 따뜻한 갈색 값을 씁니다.
- 곡 모달에 들어가는 섹션은 별도 컴포넌트입니다: FreqStepper, PerfList, ScoreAttach.
