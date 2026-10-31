# c-repo

클래식기타 레퍼토리와 연습 기록을 관리하는 정적 웹앱입니다. 화면은 GitHub Pages에서 제공하고, 로그인과 사용자별 데이터는 Supabase에서 관리합니다.

## 구조

```text
GitHub Pages
  ├─ index.html               화면과 연습 기능
  ├─ supabase-config.js       공개 가능한 프로젝트 URL/Publishable Key
  └─ supabase-storage.js      로그인·불러오기·저장 어댑터

Supabase
  ├─ Auth                     이메일 Magic Link 로그인
  └─ public.practice_documents
       └─ 사용자당 1개 JSON 문서, RLS로 본인 행만 접근
```

로그인하지 않은 동안에는 기존처럼 `localStorage`에 저장합니다. 로그인했을 때 원격 데이터가 없으면 현재 로컬 데이터를 Supabase에 올립니다. 원격 데이터가 있으면 아래 규칙으로 처리합니다. 이후 변경사항은 1.2초 디바운스로 자동 저장합니다.

### 로그인 전에 입력한 내용 보호

로그인 전에 입력한 연주회 준비 등은 서버에 올라간 적이 없으므로, 원격 데이터로 덮어쓰면 사라집니다. 이를 막기 위해 로컬에 서버에 없는 변경이 있는지(`guitar_local_dirty`)와 마지막으로 서버와 같았던 사본(`guitar_supabase_base`)을 함께 기록합니다.

| 상황 | 동작 |
| --- | --- |
| 이 기기에 서버에 없는 변경이 없음 | 원격 데이터를 그대로 받습니다. |
| 서버에 없는 변경이 있음 (로그인 전 입력, 저장 실패 등) | 마지막 동기화 사본을 기준으로 이 기기의 변경과 서버의 변경을 항목 단위(`id`/곡 제목)로 3-way 병합한 뒤 서버에도 저장합니다. 한쪽에서만 바뀐 부분은 그쪽을 따르고, 한쪽이 삭제한 항목을 다른 쪽이 수정했다면 수정본을 남기며, 같은 값을 양쪽이 다르게 바꾼 경우에만 이 기기 값을 씁니다. |
| 다른 계정으로 쓰던 사본 | 새 계정에 합치지 않고 원격 데이터를 받되, 이 기기 데이터는 백업에 남깁니다. |
| 이전 버전에서 쓰던 사본(표시 없음) | 서버에 없는 변경이 있는 것으로 보고 병합합니다. |

병합하기 전에는 이 기기 데이터와 서버 데이터를 `localStorage`에 최대 6개까지 자동 백업하며, **☁ 계정 연결** 창의 "이 기기 자동 백업"에서 복원할 수 있습니다. 서버 데이터를 확인(병합)하기 전에는 자동 저장도 서버를 덮어쓰지 않습니다.

## Supabase 연결

1. `c-repo` 전용 Supabase 프로젝트를 만듭니다. 다른 서비스의 프로젝트를 재사용하지 않는 것을 권장합니다.
2. 프로젝트에서 `supabase/migrations/*_create_practice_documents.sql`을 적용합니다.
3. 프로젝트의 Data API 설정에서 `public.practice_documents`가 노출되어 있는지 확인합니다. 마이그레이션은 `authenticated` 역할에 최소 권한을 명시적으로 부여하고 RLS를 활성화합니다.
4. Authentication → URL Configuration에서 다음 주소를 등록합니다.
   - Site URL: `https://khmass-liturgy.github.io/c-repo/`
   - Redirect URL: `https://khmass-liturgy.github.io/c-repo/**`
5. `supabase-config.js`에 Project URL과 활성화된 **Publishable Key**를 입력합니다.

```js
window.C_REPO_SUPABASE = Object.freeze({
  url: 'https://PROJECT_REF.supabase.co',
  publishableKey: 'sb_publishable_...',
  table: 'practice_documents'
});
```

Publishable Key는 브라우저용 공개 식별자이며 RLS와 함께 사용합니다. `service_role`, secret key, 데이터베이스 비밀번호는 HTML·JavaScript·Git 저장소에 절대 넣지 않습니다.

## 데이터 보호

- `practice_documents.user_id`는 `auth.users.id`를 참조하며 사용자당 한 행만 허용합니다.
- SELECT/INSERT/UPDATE/DELETE 정책마다 `(select auth.uid()) = user_id`를 검사합니다.
- UPDATE 정책에는 `USING`과 `WITH CHECK`를 모두 둡니다.
- 테이블은 RLS와 FORCE RLS를 활성화하고, `anon` 역할에는 테이블 권한을 주지 않습니다.
- 브라우저에는 Supabase 세션, 오프라인용 로컬 사본, 동기화 기준 사본, 자동 백업만 저장합니다. 별도 GitHub PAT는 사용하지 않습니다.
- 로컬 레퍼토리는 로그인해도 덮어쓰지 않고 서버 데이터와 합칩니다.

## 확인

```powershell
node tools/test-supabase-storage.cjs
node tools/test-cloud-sync.cjs
```

`test-supabase-storage.cjs`는 가짜 Supabase 클라이언트를 사용하여 설정 누락, 사용자별 조회, 저장, 로그아웃을 검사합니다. `test-cloud-sync.cjs`는 `index.html`의 실제 동기화 함수로 로그인 전 입력의 병합, 삭제 처리, 계정 전환, 불러오기·저장 도중 입력, 저장 실패, 백업·복원을 검사합니다. 실제 프로젝트 적용 후에는 Supabase Security/Performance Advisors도 확인해야 합니다.

참고 문서: [Passwordless email sign-in](https://supabase.com/docs/guides/auth/auth-email-passwordless), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Securing the Data API](https://supabase.com/docs/guides/api/securing-your-api)
