# JHT_Booking_Sys 전체 코드 감사 — 개선 사항 백로그

- 감사일: 2026-07-17
- 대상: `sksmsrkk-glitch/JHT_Booking_Sys` 최신 커밋 (`9506668 Optimize navigation and server data loading`)
- 범위: src 전체(~40,000라인, API 라우트 96개), Supabase 마이그레이션 31개 전수, 테스트/E2E, verify 스크립트 16종, 설정 파일
- 방법: 보안·API·DB·관리자 프론트·파트너 포털·자동화/도구 6개 영역 병렬 정밀 감사 + Critical 항목 코드 교차 검증
- 로컬 검증 결과: `tsc --noEmit` 오류 0건, `npm test` 116/116 통과

---

## 총평

전반적으로 **인증 경계·RLS·멱등성·승인 게이트의 기본기가 매우 높은 코드베이스**입니다. 96개 API 라우트 전수 가드 매핑 결과 비의도 무인증 노출 없음, 60여 개 전 테이블 RLS 활성, 원가/마진의 `quote_version_internals` 물리 분리, 타이밍세이프 시크릿 비교, 원자 RPC(인보이스 발행·문의 제출·워커 클레임) 등은 모범적입니다.

약점은 세 갈래로 수렴합니다:
1. **비원자 다단계 쓰기 + 낙관적 잠금 부재** — 잘 만들어 둔 원자 RPC/클레임 패턴이 일부 경로에만 적용되고, 결제·정산·견적 상태 전이·가입 승인 등은 여전히 read-then-act.
2. **컬럼 단위 내부정보 노출 잔존** — 행 단위 RLS는 견고하나 `internal_notes`, `excel_source_summary` 등 내부 컬럼이 agency가 읽을 수 있는 행에 남아 있음.
3. **전역 DOM 하이재킹 기반 UI 계층** — CalendarLocaleEnforcer/GlobalTextTranslator가 React 소유 DOM을 직접 변조하는 구조적 부채.

---

## P0 — Critical (즉시 수정 권장)

### P0-1. 비인증 호출 가능한 SECURITY DEFINER 쓰기 RPC
- `supabase/migrations/202607150002_reservation_readiness_dashboard.sql:14-63`
- `refresh_reservation_operation_readiness(uuid)`가 SECURITY DEFINER + 내부 권한 검사 없음 + **revoke 문 누락** (같은 파일의 `get_reservation_dashboard`는 212-213행에서 revoke함). PostgreSQL 기본 PUBLIC EXECUTE grant가 남아 PostgREST `/rpc/`로 anon 포함 누구나 임의 reservation의 RLS 우회 UPDATE를 유발 가능.
- 조치: `revoke all on function refresh_reservation_operation_readiness(uuid) from public, anon, authenticated;` 마이그레이션 추가. (트리거 경유 실행에는 EXECUTE 불필요)

### P0-2. 파트너 booking-request가 실 RLS 환경에서 500 + 부분 쓰기
- `src/app/api/agency/quote-cases/[id]/booking-request/route.ts:50-63`, `revision-request/route.ts:50-64`
- agency JWT 클라이언트로 `writeAuditLog()` → `audit_logs` insert 정책은 `has_internal_role()` 전용이라 RLS 거부 → throw → 500. 이 시점에 `agency_inquiries` insert는 이미 커밋되어 **파트너는 에러를 보는데 문의는 생성되는** 부분 쓰기 발생. 일반 문의 라우트는 이미 `submit_agency_inquiry_atomic` RPC로 해결했는데 이 두 라우트만 구식 경로.
- 조치: 두 라우트를 `submit_agency_inquiry_atomic`(또는 동일 패턴 전용 RPC)로 이관.

### P0-3. revision-request의 상태 전환이 조용히 무시됨
- `src/app/api/agency/quote-cases/[id]/revision-request/route.ts:43-48`
- `quote_cases` update를 agency JWT로 실행하지만 agency 정책은 select뿐 → 0행 매칭, 에러 없음. `revision_requested` 전환이 절대 반영되지 않음.
- 조치: SECURITY DEFINER RPC로 이동 + 현재 상태 검증(P1-7과 함께) + 반영 행 수 확인.

### P0-4. 결제 멱등키 조회가 인보이스 범위로 제한되지 않음
- `src/app/api/finance/invoices/[id]/payments/route.ts:46-54, 76-81`
- `idempotency_key`만으로 기존 결제를 찾고 `invoice_id` 일치 미확인. 다른 인보이스의 키 재사용 시 **타 인보이스 결제가 `replayed: true`로 반환되고 의도한 인보이스에는 결제 미기록인 채 성공 응답**.
- 조치: 조회·23505 복구 경로 모두 `.eq("invoice_id", id)` 추가, 타 인보이스 키면 409.

### P0-5. 관리자 폼 전반의 fetch 오류 미처리 → 영구 잠금
- `QuoteCaseCreateForm.tsx:596-608`, `FinalOperationSnapshotForm.tsx:82-129`, `GuideExpenseReportForm.tsx:162-175`, `QuoteItemCreateForm.tsx:94-106`, `WorkflowLedger.tsx:73-101`, `DomesticSupplierCostMasterForms.tsx:225-261` 등 (components/admin 43개 중 catch 보유 12개)
- `setIsBusy(true)` 후 fetch/json()을 try/catch 없이 호출 — 네트워크 오류 시 unhandled rejection + `isBusy` 영구 true + 에러 표시 없음.
- 조치: `try/catch/finally` 통일. 근본적으로 busy/error/success를 일원화한 공용 `useSubmit` 훅 도입.

### P0-6. 대시보드 재무 KPI가 "첫 100건"만으로 집계
- `src/app/admin/page.tsx:449-462, 510-543`
- 견적/예약/인보이스/파트너를 `pageSize: 100`으로 가져와 미수금 합계·확정 그룹 수 등을 합산. 100건 초과 시 **재무 수치가 조용히 축소 표기**, 절단 경고 없음.
- 조치: KPI는 DB 집계(RPC/count/sum)로 이전, 목록만 페이지네이션.

### P0-7. 발송 성공 후 로그 실패 시 sent → failed 역전 (이중 발송 경로)
- `src/app/api/automation/supplier-messages/run/route.ts:83-125`
- sent 기록 후 `insertEvent`/`writeAuditLog` 실패 시 catch가 무조건 `status='failed'`로 덮어씀 → 운영자가 Requeue하면 live 모드에서 실제 이중 발송. (현재 dry_run 강제라 잠재 리스크지만 live 전환 전 필수 수정)
- 조치: catch에서 `.eq("status", "sending")` 조건부 update만 수행, 또는 발송 확정 후 로그 실패는 별도 상태로 분리.

---

## P1 — High

### 데이터 노출 (Agency 경계)

**P1-1. agency가 견적 내부 컬럼을 Data API 직접 호출로 읽기 가능** *(3개 영역 감사에서 독립적으로 교차 확인)*
- `quote_itinerary_days.internal_notes` (`202605100001:310`, 정책 `:920-929`), `quote_versions.excel_source_summary`·`margin_mode`·`exchange_rate_to_krw` (`202606270002`, 정책 `:910-917`)
- 서버 쿼리는 필드를 선별하지만 RLS는 행 단위 — 파트너가 anon key + 자기 JWT로 PostgREST를 직접 호출하면 내부 운영 메모와 엑셀 원가 모델 요약(원본 파일명·수식·추출 메모)을 그대로 조회 가능. `202607040001`이 마진 컬럼을 별도 테이블로 분리한 원칙이 이 컬럼들에는 미적용.
- 조치: `internal_notes`·`excel_source_summary`·`margin_mode`를 internal 전용 테이블로 이전.

**P1-2. 발행된 인보이스·예약을 모든 internal 롤이 DELETE 가능**
- `202607030001:248-253`(invoices), `202605100001:946`(reservations)
- `for all ... with check` 구조에서 DELETE는 USING만 평가 → WITH CHECK의 "draft만" 제한이 DELETE에 미적용. reservations 삭제 시 `reservation_status_history`가 cascade 소멸 → 이력 강제 규칙 우회.
- 조치: `for delete` 전용 정책 분리 (예: finance 롤 + draft만) 또는 soft-delete.

**P1-3. `is_agency_member`가 계정 동결/사용자 정지 미검사**
- `202605100001:789-803` vs `202606300001`, `202607130001`
- `agency_users.status='active'`만 확인 — `lifecycle_status='frozen'/'withdrawn'`, `suspended_by_account_at` 설정에도 접근 유지 가능.
- 조치: helper에 lifecycle/suspension 조건 추가.

**P1-4. anon 전권 부여 이력 → 환경 드리프트 실사 필요**
- `202607020001`(anon/authenticated에 전 테이블 ALL PRIVILEGES) → 익일 `202607030001`이 회수. `202607150007/0008` "restore/repair" 마이그레이션이 수동 SQL 변경 환경의 실존을 증명 — 0703 미적용 환경이 있으면 즉시 전체 노출.
- 조치: 전 환경에서 `information_schema.role_table_grants` 실사 + `supabase db diff` 정례화.

### 원자성·동시성 (금전 경로)

**P1-5. 결제 기록 → 인보이스 상태 갱신 비원자**
- `finance/invoices/[id]/payments/route.ts:57-118` — 4단계 개별 쿼리. 중간 실패 시 결제 저장 + stale 인보이스 상태, audit 실패 시 커밋 후 500. 조치: `record_payment_atomic` RPC 통합.

**P1-6. quote version 상태 전이 TOCTOU — 두 버전 동시 accepted 가능**
- `quote-versions/[id]/status/route.ts:35-71` — `.eq("status", before.status)` 가드 없음, version/case 갱신 비원자, 44-53과 55-64행 중복 코드. 조치: 조건부 update + 0행 시 409, RPC 원자화.

**P1-7. 견적 라이프사이클 게이트 부재**
- `booking-request/route.ts:15-27`, `revision-request/route.ts:15-27` — `expired`/`accepted`/`cancelled` 케이스에도 booking/revision 요청 통과. 조치: 요청 타입별 허용 상태 화이트리스트 검증 + 409, 클라이언트 버튼 비활성화 병행.

**P1-8. 정산 recalculate ↔ approve 레이스 + approved 정산에 재무항목 계속 추가 가능**
- `finance/settlements/recalculate/route.ts:14-24,62-78`, `[id]/status/route.ts:38-45`, `src/lib/domain/finance.mjs:71-78`
- 조회-후-upsert 사이에 승인이 끼면 approved가 draft로 되돌아감. `assertFinanceEntryAllowed`는 `closed`만 차단 → approved 정산 합계가 조용히 실측과 어긋남. 조치: 조건부 update/RPC + approved 상태 항목 추가 정책 명시(차단 또는 자동 review 강등).

**P1-9. 확정서 발행 시 인보이스 자동 생성 멱등성 없음**
- `reservations/[id]/final-operation-snapshot/route.ts:69-73,89-137,199-210` — read-max+1 방식으로 더블클릭 시 중복 버전 발행. 기존 `create_invoice_version_atomic` RPC를 우회하는 별도 경로. 조치: 동일 RPC로 통일 + 멱등키.

**P1-10. 가입 승인 read-then-act — 동시 승인 시 파트너 계정 중복 생성**
- `agency/signup-applications/[id]/decision/route.ts:23,115-128` — 조치: `.update({status:'processing'}).eq("status",'pending')` 선점 패턴 이식 (migration importBatch에 이미 존재).

### 프론트엔드 구조

**P1-11. CalendarLocaleEnforcer — 전역 DOM 하이재킹 date input 교체 (347줄)**
- `src/components/CalendarLocaleEnforcer.tsx`, `app/layout.tsx:34` — body 전체 MutationObserver로 모든 date input을 text로 강제 변환 + 자체 picker. 이벤트 리스너 누수(169-190행 재-enhance 가드 결함), 네이티브 검증·min/max 소실, 자유 텍스트 무검증 제출 가능, focus trap 없음, controlled input에 네이티브 setter 직접 호출.
- 조치: 전역 패치 제거, `<DateInput>` 컴포넌트로 각 폼에서 명시적 사용.

**P1-12. GlobalTextTranslator — 문자열 사전 기반 전역 DOM 번역 (225줄)**
- `src/components/GlobalTextTranslator.tsx`, `app/layout.tsx:35` — TreeWalker + 160개 사전으로 텍스트 노드 치환, 모든 DOM 변경마다 재실행. 리렌더 시 영↔한 깜빡임, O(전체 DOM) 비용, 사전 밖 문자열은 한/영 혼재. 조치: `next-intl` 등 메시지 카탈로그 i18n으로 이전.

**P1-13. 샘플/플레이스홀더 기본값이 실데이터로 저장될 수 있음**
- `FinalOperationSnapshotForm.tsx:422-448` — "Confirmed hotel name", `accountNo: "TBA"`, 하드코딩 SWIFT로 시작해 그대로 **인보이스 발행 가능**. `GuideExpenseReportForm.tsx:79-81,327-354` — PMB 샘플 8행이 기본 로드되어 실제 비용으로 동기화 가능. `QuoteCaseCreateForm.tsx:145-167` — "Sample service" 단가 100000 기본 행.
- 조치: 샘플 주입은 previewMode 한정, 운영 모드는 빈 값 + 필수 검증, 확정서 폼은 예약 데이터 프리필.

**P1-14. 금액·일시 포맷 불일치**
- `InvoiceDocument.tsx:284-286`(locale/소수점 미지정 → USD 345.5가 "345.5"), `:288-290`(UTC slice → KST 9시간 오차), formatMoney 구현 4곳 상이, `QuoteCaseCreateForm.tsx:906,1174` 통화 단위 미표기.
- 조치: `Intl.NumberFormat` 기반 공용 `formatCurrency` + `formatDateTime(tz:"Asia/Seoul")`을 `src/lib/format.ts`로 단일화.

**P1-15. 공급사 마스터 다단계 순차 POST — 부분 저장·고아 데이터**
- `DomesticSupplierCostMasterForms.tsx:60-136` — 공급사→상품→가격→미디어를 클라이언트 루프로 실행, 중간 실패 시 고아 데이터 + 같은 이미지를 상품마다 중복 업로드(124-127행). 조치: 서버 단일 라우트 + 트랜잭션.

**P1-16. QuoteCaseCreateForm 1,787줄 분해 + 렌더 내 중복 계산**
- 합계를 렌더마다 2회 전체 재계산(906, 1216-1218행), `useMemo` 없음. 버그: 동일 dayNo 일정 2행이면 item 중복 렌더 + React key 충돌(1653-1660행), row id `Date.now()` 충돌 가능(1588행).
- 조치: FxTable/ItemsTable/ItineraryTable/`useQuoteCalculation` 훅/샘플 데이터 파일로 분리, `crypto.randomUUID()`.

### 자동화·운영

**P1-17. supplier message "sending" 고착 시 복구 경로 없음**
- `automation/supplier-messages/run/route.ts:61-67` — 클레임 후 프로세스 사망 시 영구 고착. quote_exports와 달리 lease 없음, requeue는 failed만 허용, failed-jobs 화면도 failed만 노출. 조치: lease 컬럼 또는 "sending N분 초과 → failed" sweep.

**P1-18. notifications를 소비하는 코드가 없음 — 리마인더 dead-end**
- `from("notifications")` 참조는 쓰기 2곳뿐, 조회 UI/발송 파이프라인 전무. 리마인더가 트리거·멱등키·로그까지 갖추고도 최종 전달이 미구현. 조치: 알림 표시/발송 연결 또는 문서에 미구현 명시.

**P1-19. 수제 xlsx 파서 구조 한계 + 파서 테스트 0건**
- `src/lib/domain/supplier-excel.mjs:257-280` — data descriptor(flag bit 3) 미처리로 스트리밍 저장 xlsx 조용히 실패, zip64 미지원, 날짜 serial number 미변환("45123" 유입 가능). writer 테스트만 있고 사용자 업로드를 받는 parser 테스트 전무. 조치: 실산출물 fixtures round-trip 테스트 + 날짜 serial 처리, 장기적으로 파싱 계층 라이브러리 교체.

**P1-20. 레이트리밋 지문이 클라이언트 조작 가능한 X-Forwarded-For 좌측값 의존**
- `src/lib/api/account-recovery.ts:13-15`, `agency/signup-applications/route.ts:66-67` — XFF 변조로 시간당 5회 제한(비밀번호 재설정·이메일 조회·가입신청) 우회 가능. 시크릿 폴백도 서비스롤 키/`"local-only"` 고정값. 조치: 신뢰 프록시 우측값/플랫폼 보장 IP 사용 + 전용 시크릿 필수화.

---

## P2 — Medium

### API 견고성
- **P2-1.** `.single()` 오용으로 미존재 ID가 404 대신 500 — `payments`, `reservations/[id]`, `supplier-messages/[id]/send·approve·requeue`, `operation-tasks/[id]·remind`, `quote-exports/[id]/retry`, `generate-operation-tasks`, `supplier-messages/draft` 등 10여 곳. `maybeSingle()`+404로 통일.
- **P2-2.** provider-callback 상태 역행 방어 없음 — `provider-callback/route.ts:56-67`: sent 후 지연 도착한 sending/failed가 상태 되돌림, 이벤트 dedupe 없음. 전이 우선순위 맵 + 이벤트 upsert 키.
- **P2-3.** approve 라우트 — approved 상태 재승인 시 `approved_by` 덮어쓰기(2차 승인 "다른 사용자" 검증 세탁 가능), 낙관적 잠금 없음 — `supplier-messages/[id]/approve/route.ts:23-52`.
- **P2-4.** gmail webhook check-then-insert 레이스 — 동시 재전송 시 두 번째가 500(멱등 응답 대신) — `gmail/webhook/route.ts:18-36,107-123`. 23505 → `duplicate:true`.
- **P2-5.** 예약 생성 check-then-insert 레이스 + reservation/history/thread 비원자 — `reservations/route.ts:55-96`.
- **P2-6.** 견적 버전 생성 — version_no read-max+1 레이스, 일자별 루프 insert N+1, 부분 실패 미정리 — `quote-cases/[id]/versions/route.ts:114-180`.
- **P2-7.** admin/users 역할 delete-then-insert — 실패 창에서 무역할, "마지막 admin" 가드 없음 — `admin/users/route.ts:59-64`.
- **P2-8.** agencies lifecycle — `requireInternalUser`라 sales 롤도 파트너 동결/탈퇴 가능(admin이어야 할 거버넌스), DB↔Auth 갱신 비원자 — `agencies/[id]/lifecycle/route.ts:14,53-81`.
- **P2-9.** import-xlsx — 재업로드 시 가격 중복 적재(멱등성 없음), 행 단위 N+1, 파일 크기 제한 없음 — `domestic-suppliers/import-xlsx/route.ts:30-83,176-198`.
- **P2-10.** 가이드 지출결의서 — draft→approved 직행 허용, 3단계 비원자 — `reservations/[id]/guide-expense-report/route.ts:44-58,66-146`.

### 루밍리스트·PII
- **P2-11.** 업로드 멱등 재시도가 RLS로 실패 — agency에 `rooming_lists` update 정책 없음 → onConflict upsert의 update 경로 거부. `storagePath`/`idempotencyKey`/`originalFilename` 클라이언트 임의 지정(경로 조작·글로벌 멱등키 충돌 DoS성 오용 가능), PII 전면 교체인데 audit 미기록 — `agency/rooming-lists/upload/route.ts:25-50`. 서버 생성 경로/키 + update 정책(또는 RPC) + audit 추가.
- **P2-12.** DOB 파싱이 MM/DD/YYYY 가정 — `src/lib/domain/rooming-list.mjs:178-185`: DD/MM 문화권(주 고객 말레이시아) 승객 생년월일 뒤바뀜, 모호값 검증 없음. 형식 명시/모호성 반려.
- **P2-13.** `passengers.passport_no`·DOB 평문 저장 — 암호화/마스킹 검토(pgsodium/Vault), `passenger_no` NULL 시 unique 무력(중복 적재 가능) — `202605100001:415-419`.

### 재무 계산
- **P2-14.** 인보이스 라인별 환산·반올림 합산 vs 견적 총액 1회 환산 — 누적 오차로 파트너 화면 금액 불일치 가능, `unit_amount×quantity≠total` — `features/finance/auto-invoice.ts:70-77,117-131`. 잔차 보정(penny allocation).
- **P2-15.** 정산 집계 — `payments.status===undefined`를 confirmed 취급, payments 통화가 통화 일관성 검사에서 제외 — `src/lib/domain/settlement.mjs:74-92`.

### DB 스키마
- **P2-16.** FK 인덱스 다수 누락 — `payments.invoice_id`(restrict FK), `reservation_status_history.reservation_id`, `expenses/extra_revenues/shopping_commissions.reservation_id`, `supplier_message_events`, `email_*`, `audit_logs(entity_table,entity_id)/created_at` 등 (상세 목록은 DB 감사 원문 참조).
- **P2-17.** CHECK 없는 text 상태 컬럼 — `agency_inquiries.status`, `quote_exports.status`, `rooming_lists.parsed_status`, `invoices.collection_status`, `quote_items.margin_mode` 등 다수. CHECK/enum 승격.
- **P2-18.** `202607130002`의 `reservations_quote_case_uidx`(전체 unique)가 0703의 cancelled 제외 부분 unique 설계를 뒤집음 — **취소 후 동일 견적 재예약 불가**. 의도 확인 필요.
- **P2-19.** `room_assignments.passenger_ids uuid[]` — FK 불가, orphan uuid. 조인 테이블 전환.
- **P2-20.** 마이그레이션 드리프트 관리 — restore/repair 이력이 수동 SQL 변경 환경 실존을 증명. `supabase db diff` 정례화 + `if not exists` 방어 코딩의 은폐 효과 인지.

### 도구·테스트·운영
- **P2-21.** verify-api-body-order가 컨벤션 헬퍼 `readJson`을 미감지 — 실제 위반 라우트(approve, draft, gmail-review 등)를 통과시키는 거짓 확신. 패턴에 `readJson|readFormData` 추가(1줄) — `scripts/verify-api-body-order.mjs:9`.
- **P2-22.** 자동화 트리거 미코드화 — vercel.json에 crons 없음, 런북 문서로만 존재. 누락 시 리마인더/발송/export 조용히 정지. crons 코드화 + readiness에 "마지막 run 시각" 체크.
- **P2-23.** 핵심 money 로직(.mjs ~8,000줄)이 typecheck 밖 — `checkJs: true`+JSDoc 또는 .ts 전환.
- **P2-24.** E2E가 credential 없으면 사실상 전부 skip — 기본 실행은 비인증 shell 1건. 소스 정규식 단언형 테스트 다수는 동작 검증 아님(분류 정직화 필요).
- **P2-25.** 영어 전용 보장이 UI 문자열에만 적용 — DB 유래 콘텐츠(tour_name, public_description, 일정 title 등)의 한국어가 파트너 화면에 그대로 렌더. sent 전환 게이트에 공개 필드 한글 검증 추가가 실효적.
- **P2-26.** `/api/agency/quote-cases/[id]` GET — 쿼리 통째 복제 + 호출처 없음 + KRW 미환산 금액 반환(소비자가 붙는 순간 통화 오표시). 재사용으로 교체 또는 삭제.
- **P2-27.** WorkflowLedger가 서버 props를 state로 복사 — 갱신 반영 안 됨, camel/snake 이중 매핑 `any` — `WorkflowLedger.tsx:49-50,238-272`.
- **P2-28.** 국가 목록을 폼마다 클라이언트 재fetch — 상위 서버 컴포넌트 props로 전달 — `QuoteCaseCreateForm.tsx:475-493`, `QuoteItemCreateForm.tsx:50-62`.
- **P2-29.** forgot-email 열거 리스크(3필드 매칭 시 마스킹 이메일 노출, P1-20과 결합 시 대량 시도) + `/api/health` 무인증 구성 boolean 노출 — 강화된 레이트리밋과 내부 전용 전환.
- **P2-30.** 목록 쿼리 고정 limit + JS 필터 — `listSettlements`는 최신 150건 안에서만 검색 동작 — `features/finance/queries.ts:125-136` 등. `parsePagination`+`range` 패턴 이관.

---

## P3 — Low

- **P3-1.** 죽은 코드 — `LegacyGroupStatusCalendar` + `buildMonthDays` + `getCalendarCell` (`admin/reservations/page.tsx:385-462,659,719`) 미사용, 삭제.
- **P3-2.** 유틸 중복 — `formatLabel` 50개 파일, `formatDateTime` 20개+ 파일, `optionalString`류 15개+ 라우트 재구현(일부는 조용한 `String()` 강제 변환으로 의미 상이), `roundMoney` 3곳. `src/lib/format.ts`·`lib/api/http.ts`로 일원화.
- **P3-3.** 접근성 — `<a href onClick>` 버튼 사용(`DomesticSupplierCostMasterForms.tsx:142-157,687-771`), 탭 role 없음, 로딩 스피너/aria-busy 부재. 성공/실패 판정을 `message.includes("failed")`로 하는 곳(`FinalOperationSnapshotForm.tsx:350`)은 별도 state로.
- **P3-4.** `request.url` 기반 재설정/초대 링크 생성 — Host 헤더 의존(Supabase allowlist가 완화 요소). canonical origin 환경변수 사용 — `auth/forgot-password/route.ts:17` 외 4곳.
- **P3-5.** audit log 실패 시 커밋 후 500 정책 — 재시도가 비멱등 라우트에서 이중 실행 유발 가능. 본 작업과 동일 트랜잭션 포함 여부 정책 결정.
- **P3-6.** CSP 헤더 부재 — `next.config.mjs`에 X-Frame-Options 등은 있으나 Content-Security-Policy 없음.
- **P3-7.** 인보이스 export의 `preview-` 무인증 우회가 데모 게이트 없이 잔존 — `finance/invoices/[id]/export-xlsx/route.ts:50-70` (cookie substring 매칭 포함). `[shareId]` 페이지 preview fallback도 `isDemoModeEnabled()` 게이트 및 preview-boundary 테스트 guardedPages 누락.
- **P3-8.** "partner" 명명 잔재 — 인덱스명 `partner_receivable_ledger_*`, `partner_visible`, 파일명 2건 등. agency로 통일 권장(경계 위반 자체는 0703에서 해소됨).
- **P3-9.** 기타 — `operation-tasks/[id]/remind` body.message 타입 미검증, `exchange-rates` status 자유 문자열, invoices quantity 음수 미검증, `generate-operation-tasks` 0건 삽입에도 201, supplier_media 10장 제한 트리거 동시성, `agency_signup_applications` DB 레벨 스팸 방지 없음, workflow_code↔case_code 문자열 연계(FK 없음), verify-security-config의 들여쓰기 포함 스니펫 매칭(포맷 변경에 오탐).

---

## 권장 착수 순서

1. **P0-1, P0-4** — 각각 마이그레이션 1건, 코드 2줄 수준으로 즉시 수정 가능하면서 보안/금전 리스크 차단 효과 최대.
2. **P0-2, P0-3, P1-7** — 파트너 포털 핵심 전환 동작(booking request)이 실 RLS 환경에서 깨져 있으므로 `submit_agency_inquiry_atomic` 패턴으로 묶어서 이관.
3. **P0-5, P0-6, P1-13** — 관리자 운영 품질(폼 잠금, KPI 오류, 샘플 데이터 오염).
4. **P1-5~P1-10** — 금전 경로 원자성. 코드베이스에 이미 있는 클레임/RPC 패턴을 이식하면 됨.
5. **P0-7, P1-17, P1-18** — supplier 발송 live 전환 전 필수.
6. **P1-1~P1-4** — RLS 컬럼 분리·정책 보강 마이그레이션 일괄.
7. **P1-11, P1-12, P1-14, P1-16** — 프론트 구조 부채(전역 DOM 패치 → 컴포넌트/i18n, 포맷 유틸 단일화, 거대 폼 분해).
