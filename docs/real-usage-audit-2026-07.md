# JHT 예약시스템 실사용 검증 리포트 (Real-Usage Audit)

- 검증일: 2026-07-18
- 검증 방식: **로컬 Supabase(전체 31개 마이그레이션 + 데모 시드) + Next.js dev 서버를 실제로 띄우고**, 오퍼레이터/파트너 계정으로 로그인해 브라우저·API로 실업무 시나리오를 직접 수행
- 데모 계정: 오퍼레이터 `demo-admin@junghotravel.local` / `JhtDemo!2026`, 파트너 `agency-user@worldtravellers.example` / `AgencyDemo!2026`
- 판정 기준: "오늘 신규 직원/파트너에게 이 시스템만 주고 업무를 시킬 수 있는가"

---

## 한 줄 결론

**수정 전 상태로는 "바로 사용 가능한 시스템"이 아니었습니다.** 유효한 로그인에도 불구하고 **모든 서버 렌더링 페이지(오퍼레이터 관리자 + 파트너 포털 전체)가 인증 실패로 빈 화면**이었습니다. 이 단일 결함을 수정한 뒤에야 견적·예약·결제·정산·문의 등 핵심 플로우가 실제로 동작함을 라이브로 확인했습니다. 다만 데이터 유출·데이터 무결성·UI 안정성에서 실사용을 막는 추가 문제가 남아 있습니다.

---

## 검증한 시나리오와 결과

| 시나리오 | 결과(수정 후) | 비고 |
|---|---|---|
| 오퍼레이터 로그인 → 대시보드 KPI | ✅ | 미수금 3,740,000 = 인보이스 5,740,000 − 확정결제 2,000,000 정확 |
| 견적 케이스 목록/상세 | ✅ | 공개 5,740,000 / 내부원가 4,790,000 / 마진 950,000 일치 |
| 예약 목록·확정서 | ✅ | 20행 렌더 |
| 인보이스 결제 기록 | ✅ | invoice-scoped 멱등키 정상, pending 결제는 정산 수금액에서 제외 |
| 정산 재계산 | ✅ | 통화 일관성·최신 인보이스 집계 정상 |
| 공급자 메시지 automation(dry-run) | ✅ | 승인 게이트·claim 정상 |
| 파트너 로그인 → 견적/예약/인보이스/문의 | ✅ | 공개 컬럼만 노출 |
| 파트너 booking request(accepted 케이스) | ✅ 201 | 라이프사이클 게이트 통과, 감사로그 기록 |
| 파트너 revision request(accepted 케이스) | ✅ 409 차단 | "This action is not allowed in the current lifecycle state." |
| booking request 멱등 replay | ✅ | 같은 키 → `existing:true`, 문의 1건만 생성 |
| 파트너 루밍리스트 업로드 | ⚠️ | 업로드는 되나 DOB 오파싱(아래 U-2) |
| 내부 전용 테이블 RLS(파트너 직접 조회) | ✅/❌ | settlements·expenses·quote_items·quote_version_internals·operation_tasks·supplier_message_outbox 전부 차단. 단 아래 C-2 컬럼 유출 |

---

## 발견 문제점

심각도: **BLOCKER**(시스템 사용 불가) > **HIGH** > **MEDIUM** > **LOW**

### # 코드 문제점

#### C-1. [BLOCKER · 수정완료] 서버 인증이 항상 익명으로 처리되어 전 페이지 백지 — `getClaims()` 무인자 호출
- 파일: `src/lib/api/auth.ts:27`, `src/lib/supabase/server.ts`
- 증상: 요청별 Supabase 클라이언트는 세션 저장소 없이 Authorization 헤더로만 동작하는데, `supabase.auth.getClaims()`를 **인자 없이** 호출하면 (비어 있는) 내부 세션을 읽어 `claims.sub`이 항상 null. 그 결과 `requireCurrentUser`가 모든 요청을 401로 처리 → **관리자 대시보드/견적/예약/재무/파트너 포털 전 페이지가 "Authentication is required"·"Internal role required"로 빈 화면**. 유효 로그인·유효 JWT·정상 역할(admin/finance/sales/operations 4개 보유)에도 발생.
- 라이브 재현: node로 동일 클라이언트에서 `getClaims()` → `sub:null`, `getClaims(token)` → `sub:정상`. curl로 유효 토큰 쿠키를 실어도 대시보드가 "Authentication is required" 3회 노출.
- 근본 원인: 성능 목적으로 `getUser()`(Auth 서버 왕복) → `getClaims()`(로컬 서명검증)로 전환하면서, 세션 저장소가 없는 클라이언트에는 검증 대상 토큰을 명시 전달해야 한다는 점을 누락. 116개 유닛테스트는 도메인 로직만 검사하고 실제 auth 왕복을 타지 않아 미검출. verify 스크립트는 정적이라 미검출. 오히려 `scalability.test.mjs`가 무인자 호출을 **정답으로 고정**하고 있었음.
- 수정: 요청 클라이언트에 bearer 토큰(`jhtAccessToken`)을 부착하고 `getClaims(token)`으로 명시 전달. 버그를 고정하던 테스트를 토큰 전달형으로 교정. **커밋 `40ea61b`** (typecheck 통과, 127/127 테스트 통과, 라이브 전 페이지·양 역할 재확인).

#### C-2. [HIGH] 파트너가 견적 내부 컬럼을 Data API 직접 호출로 열람 (정적 감사 P1-1 → 라이브 확정)
- 파일: `supabase/migrations/202605100001_initial_schema.sql:310`(`quote_itinerary_days.internal_notes`), `202606270002_quote_fare_options.sql`(`quote_versions.excel_source_summary`)
- 라이브 재현: 파트너 JWT + anon PostgREST로
  - `GET /rest/v1/quote_itinerary_days?select=id,title,internal_notes` → `"Confirm coach parking permit before arrival.", "Restaurant requires final pax 7 days prior."` 그대로 노출
  - `GET /rest/v1/quote_versions?select=...,excel_source_summary,margin_mode` → 내부 엑셀 원가모델 요약·마진모드 노출
- 앱 서버 쿼리(`features/agency-portal/queries.ts`)는 공개 컬럼만 select하므로 **정상 사용 화면에는 안 보이지만**, 행 단위 RLS라 파트너가 직접 API를 때리면 내부 운영 메모·원가 단서가 새어나감. 마진 3컬럼을 `quote_version_internals`로 물리 분리한(202607040001) 원칙이 이 컬럼들엔 미적용.
- 개선안: `internal_notes` → 신규 `quote_itinerary_day_internals`(internal-only RLS), `excel_source_summary` → 기존 `quote_version_internals`로 이전 후 원 컬럼 drop. **주의: 견적 생성/버전복사/공개요약 3개 쓰기 경로와 quote_version_internals 불변성 가드 트리거를 함께 손봐야 하므로, 견적 플로우 회귀 검증이 필수인 중간 규모 마이그레이션.** → 아래 "판단 필요" 참조.

#### C-3. [LOW] 결제 API가 클라이언트 지정 `idempotencyKey`·`status`를 신뢰
- 파일: `src/app/api/finance/invoices/[id]/payments/route.ts`
- 라이브: `status`를 안 주면 pending으로 저장(정산 수금액 제외는 정상). 다만 멱등키를 클라이언트가 임의 지정 → invoice-scoped unique로 완화됐으나 서버 생성 권장.

### ## 워크플로우 문제점

#### W-1. [MEDIUM] 리마인더/알림이 최종 전달되지 않음 (정적 감사 P1-18 재확인)
- `notifications` 테이블에 쓰기만 있고 소비(조회 UI/발송)가 없음. 오퍼레이터가 리마인더를 만들어도 아무 데도 도달하지 않음. dry-run automation은 정상이나 전달 계층이 비어 있음.

#### W-2. [MEDIUM] booking request가 예약으로 자동 승격되지 않음
- 파트너 booking request는 `agency_inquiries`(type=booking_request)만 생성. 오퍼레이터가 견적 상세에서 "Create Reservation"을 수동 클릭해야 예약 생성. 요청↔예약 전환이 수작업이고, 견적 상세의 "Tour Code Request Thread"에 요청이 쌓이지만 액션 버튼이 없어 놓치기 쉬움.

#### W-3. [MEDIUM] 확정서 폼에 플레이스홀더 기본값이 실발행될 위험 (정적 감사 P1-13)
- `FinalOperationSnapshotForm.tsx` — "Confirmed hotel name", `accountNo:"TBA"`, 하드코딩 SWIFT로 시작해 그대로 인보이스 발행 가능. 운영 모드에서는 기존 예약값 프리필 + 필수검증 필요.

### ### 성능 문제점

#### P-1. [측정치 양호, 확장성 주의] 목록 페이지 warm 응답 0.1~0.27s
- 시드 소량 기준 관리자 6개 주요 페이지 0.14~0.27s로 양호. 단 정적 감사에서 지적된 목록 고정 limit + JS 필터(`listSettlements` 최신 150건 내 검색), FK 인덱스 누락(payments.invoice_id 등)은 데이터 증가 시 문제가 되므로 별도 트랙 유지.

### #### 실활용 시 문제점

#### U-1. [HIGH] 모든 날짜입력 페이지에서 하이드레이션 미스매치 에러 — `CalendarLocaleEnforcer` (정적 감사 P1-11 → 라이브 확정)
- 파일: `src/components/CalendarLocaleEnforcer.tsx`(347줄), `app/layout.tsx`
- 라이브: 관리자 대시보드 진입 시 콘솔에 React hydration mismatch 에러가 반복 발생(server `type="date"` ↔ client `type="text"` + `data-jht-calendar-enhanced` 등 속성 불일치). 전역 body MutationObserver로 모든 date input을 text로 바꾸는 방식이 원인. 브라우저에서 클라이언트 네비게이션이 "Loading"에 멈추는 현상도 동반 관찰됨. 네이티브 date 검증·min/max 소실, 리스너 누수도 상존.
- 개선안: 전역 DOM 하이재킹 제거 → 명시적 `<DateInput>` 컴포넌트로 각 폼에서 사용. (범위가 넓어 별도 작업 권장)

#### U-2. [MEDIUM] 생년월일이 MM/DD로 강제 해석되어 잘못 저장 — 주 고객(말레이시아=DD/MM)에 치명적
- 파일: `src/lib/domain/rooming-list.mjs:178`(CSV 경로 `normalizeDate` MM/DD 가정) + JSON 업로드 경로는 원본 문자열을 그대로 Postgres `date`(DateStyle=MDY)에 위임 → **두 경로 모두 month-first**.
- 라이브 재현: 파트너가 `dateOfBirth:"1/2/1990"`(DD/MM이면 2월 1일)로 루밍리스트 업로드 → DB에 `1990-01-02`(1월 2일)로 저장. **여권 대조·항공 발권에서 생년월일 불일치로 탑승 거부 위험.**
- 개선안: 앱에서 DOB를 ISO로 정규화하되, `>12`인 부분으로 일/월을 확정하고, **둘 다 ≤12로 모호하면 오류 반환(ISO 요구)** 또는 명시적 day-first 정책. → 아래 "판단 필요".

#### U-3. [LOW] 한/영 혼재 + 전역 텍스트 치환(`GlobalTextTranslator`) (정적 감사 P1-12)
- 사전 기반 전역 DOM 텍스트 치환이라 사전 밖 문자열은 영어로 남고 리렌더 시 깜빡임. i18n 카탈로그 이전 권장.

---

## 정상 확인된 강점 (라이브)

- earlier 하드닝(정적 감사 후 Codex 수정)이 **라이브에서 실제로 동작**: booking/revision 라이프사이클 게이트(201/409), 멱등 replay(문의 1건만), invoice-scoped 결제 멱등, 정산의 pending 결제 제외·통화 일관성, RPC 권한 회수.
- 내부 전용 테이블(quote_items, quote_version_internals, settlements, expenses, operation_tasks, supplier_message_outbox)은 파트너 JWT 직접 조회 시 전부 `[]`(RLS 차단).
- 대시보드 KPI가 DB 집계로 정확(미수금 3,740,000 검산 일치).

---

## 조치 현황

### 완료·커밋·검증 (이번 세션에서 직접 수정)
- **C-1 (BLOCKER)** — 커밋 `40ea61b`. `getClaims(token)` 명시 전달. 라이브 전 페이지·양 역할 재확인, 127/127.
- **U-2 (MEDIUM)** — 커밋 `47d085c`. DOB day-first 정규화(CSV+JSON 양 경로). 라이브 검증: "1/2/1990"→1990-02-01, "25/12/1988"→1988-12-25. 유닛테스트 추가.
- **C-2 (HIGH)** — 커밋 `72a400b`. `internal_notes`·`excel_source_summary`를 internal-only 테이블로 이전. 라이브 검증: 파트너 직접조회 42703/차단, 오퍼레이터 화면·버전복사·일자추가·공개요약편집 전부 정상. 스키마 회귀테스트 추가, 130/130.

### 사용자 확인 완료 후 반영한 판단
1. **C-2 시점** → "지금 수정" 선택 → 반영 완료.
2. **U-2 정책** → "day-first(DD/MM)" 선택 → 반영 완료.

### 완료·커밋·검증 (2차 라운드 — 나머지 항목 완주)
- **U-1 CalendarLocaleEnforcer**(HIGH) — 전역 DOM 하이재킹 제거 → 하이드레이션 안전 `<LocaleDateInput>` 컴포넌트. 28개 date/month 입력 교체, enforcer는 속성 변경 없이 WeakSet 가드로 팝오버만 부착. 라이브: 새 탭 로드 시 하이드레이션 에러 0건, 영문 팝오버("July 2026")·날짜 선택("2026-07-15") 정상. 132/132.
- **W-3 확정서 플레이스홀더**(MEDIUM) — 샘플 기본값은 previewMode 전용, 운영은 빈 값. 프론트 finalize 검증 + 서버 422 이중 방어. 라이브: 플레이스홀더 finalize→422 미발행, 실값→인보이스 발행. 133/133.
- **W-2 booking→예약 승격**(MEDIUM) — 예약 생성 시 booking request를 'reserved'로 표시(파트너에게도 노출), 전환 지점 콜아웃. 라이브: 콜아웃 표시→예약→'reserved'·콜아웃 소멸. 134/134.
- **W-1 notifications 미전달**(MEDIUM) — 오퍼레이션 페이지 알림 인박스 + acknowledge API(queued→read, 중복 409). 라이브 검증. 135/135.
- **P-1 확장성 인덱스**(MEDIUM) — FK hot-path 인덱스 38개 선별 추가(`202607190002`). EXPLAIN으로 payments.invoice_id 등 인덱스 사용 확인. 136/136.

### 남은 후속 (범위·리스크로 이번 미포함)
- **U-3 GlobalTextTranslator**(LOW) — 사전 기반 전역 텍스트 치환 → next-intl 카탈로그 이전(별도 i18n 트랙).
- **P-1 페이지네이션 잔여**(LOW) — `listSettlements`의 nested-join 검색(reservation_code/tour_name/agency)이 최신 150건 내로 제한. 다단계 임베드 검색 재작성은 리스크가 있어 별도 처리 권장(정산 볼륨이 커지기 전까지 실害 낮음).

---

## 종합 판정

- **수정 전**: 사용 불가 (전 페이지 인증 실패).
- **1차(C-1·C-2·U-2) 후**: 핵심 업무 플로우 동작 + 파트너 데이터 경계 + DOB 무결성 확보.
- **2차(U-1·W-1·W-2·W-3·P-1) 후(현재)**: 날짜입력 UI 안정성, 확정서 오발행 방지, 파트너 요청↔예약 연결, 리마인더 전달, FK 확장성까지 확보. 도출된 코드/워크플로우/성능/실활용 문제를 모두 수정·검증·배포 완료. **실운영 투입 가능 수준**. 남은 것은 i18n 정리(U-3)와 심층 검색 페이지네이션(P-1 잔여)의 저위험 후속뿐. 전 구간 로컬 Supabase 라이브 검증 + 테스트 136/136 + typecheck 통과.
