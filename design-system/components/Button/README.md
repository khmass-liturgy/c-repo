버튼은 기본이 외곽선이며, 금색으로 채운 버튼은 도구마다 하나뿐인 주 동작을 뜻합니다.

`index.html`에서 손으로 옮긴 정적 CSS 클래스입니다. `<button>`에 아래 클래스 조합 하나와 짧은 한국어 라벨을 넣으세요.

| 클래스 | 쓰임 |
| --- | --- |
| `hdr-btn hdr-btn-ghost` | 헤더 보조 동작(＋ 카테고리). |
| `hdr-btn hdr-btn-print` | 인쇄. 녹색 기운. |
| `hdr-btn hdr-btn-cloud` | 계정 동기화. 로그인하면 `connected`를 더합니다. |
| `btn-primary` | 모달 푸터의 확인. `gold-wash` 위 금색 외곽선. |
| `btn-ghost` | 취소. |
| `btn-danger` | 삭제. 모달 푸터 맨 왼쪽에 둡니다. |
| `timer-btn`, `timer-btn primary` | 도구 컨트롤. `primary`만 `gold`로 채우며 글자는 `on-gold`입니다. |
| `duration-pill`, `active` | 짧은 선택지 중 하나(15분, 30분, 60분). |
| `cat-action-btn`, `del` | 글리프 하나를 담는 24px 둥근 버튼. `aria-label`을 주세요. |

- `timer-btn primary`는 도구마다 하나만 씁니다. 나머지는 외곽선으로 둡니다.
- 금색 채움 위에 `cream` 글자를 쓰지 않습니다.
- 원본에서 삭제 버튼과 색 기운 버튼의 테두리는 투명도가 낮습니다. 색만으로 뜻을 전하지 말고 낱말과 함께 쓰세요.
