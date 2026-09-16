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

로그인하지 않은 동안에는 기존처럼 `localStorage`에 저장합니다. 처음 로그인했을 때 원격 데이터가 없으면 현재 로컬 데이터를 Supabase에 올리고, 이미 원격 데이터가 있으면 원격 데이터를 내려받습니다. 이후 변경사항은 1.2초 디바운스로 자동 저장합니다.

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
- 브라우저에는 Supabase 세션과 오프라인용 로컬 사본만 저장합니다. 별도 GitHub PAT는 사용하지 않습니다.
- 기존 로컬 레퍼토리는 로그인 전까지 삭제하거나 덮어쓰지 않습니다.

## 확인

```powershell
node tools/test-supabase-storage.cjs
```

테스트는 가짜 Supabase 클라이언트를 사용하여 설정 누락, Magic Link 요청, 사용자별 조회, 자동 저장, 로그아웃을 검사합니다. 실제 프로젝트 적용 후에는 Supabase Security/Performance Advisors도 확인해야 합니다.

참고 문서: [Passwordless email sign-in](https://supabase.com/docs/guides/auth/auth-email-passwordless), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Securing the Data API](https://supabase.com/docs/guides/api/securing-your-api)
