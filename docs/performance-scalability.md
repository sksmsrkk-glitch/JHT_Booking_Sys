# 성능·확장성 운영 가이드

## 1. 2026-07-15 기준선

로컬 프로덕션 빌드와 로컬 Supabase에서 측정한 값이다. 운영 환경에서는 같은 스크립트로 다시 기준선을 만든다.

| 시나리오 | 요청 수 / 동시성 | 오류 | p95 | p99 | 최대 |
|---|---:|---:|---:|---:|---:|
| 공개 페이지 | 240 / 12 | 0 | 128.2ms | - | 182.1ms |
| 인증 API 4종, 최종 빌드 | 300 / 15 | 0 | 211.2ms | 282.2ms | 297.9ms |

인증 API 대상은 reservations 목록, reservation dashboard, quote cases, domestic suppliers이다. 이 결과에서는 Java 전환으로 얻을 CPU 이득보다 서비스 간 호출·배포·장애 지점 증가 비용이 더 크다.

## 2. 현재 적용된 최적화

- 모든 핵심 목록의 DB pagination과 최대 100행 제한
- 서버측 검색·정렬·필터 및 exact count
- 예약 readiness 컬럼과 DB dashboard aggregation
- 검색·정렬 복합 인덱스와 trigram 인덱스
- 공개 국가 마스터 CDN 캐시, 민감 업무 응답 no-store
- `x-request-id`, `Server-Timing`, 느린 요청 구조화 로그
- 문의·CSV·인보이스 다단계 쓰기의 DB 트랜잭션과 멱등성
- quote export worker의 lease, `SKIP LOCKED`, 만료 작업 재수거
- Playwright 데스크톱/모바일 E2E와 부하 smoke script

## 3. 성능 예산

| 지표 | 목표 | 경고 | 조치 기준 |
|---|---:|---:|---:|
| 일반 읽기 API p95 | 500ms 이하 | 750ms | 15분 이상 750ms 초과 |
| 쓰기 API p95 | 750ms 이하 | 1,200ms | 15분 이상 1,200ms 초과 |
| 5xx 오류율 | 0.5% 미만 | 1% | 5분 이상 1% 초과 |
| DB pool 사용률 | 70% 미만 | 80% | 80% 지속 시 pool/쿼리 점검 |
| Node event-loop lag p95 | 50ms 미만 | 100ms | CPU 작업 worker 분리 검토 |
| worker queue oldest age | 60초 미만 | 300초 | worker 수평 확장 또는 Java 검토 |
| worker 실패율 | 1% 미만 | 3% | 자동 중단·원인 분석 |

## 4. 단계별 확장 순서

1. 느린 endpoint의 request ID와 `Server-Timing`을 확인한다.
2. `EXPLAIN (ANALYZE, BUFFERS)`로 DB 쿼리와 인덱스를 점검한다.
3. N+1, 불필요한 exact count, 큰 JSON, 높은 offset을 줄인다.
4. 공개·공통 참조 데이터만 캐시한다.
5. Supabase compute와 connection pool을 조정한다.
6. 무상태 웹 인스턴스를 수평 확장한다.
7. 장시간·CPU 중심 작업을 queue worker로 이동한다.
8. worker 자체가 임계치를 넘을 때만 Java worker를 도입한다.

## 5. 부하 테스트

```powershell
$env:LOAD_BASE_URL = "http://127.0.0.1:3115"
$env:LOAD_PATHS = "/api/reservations?page=1&pageSize=20,/api/reservations/dashboard?month=2026-10,/api/quote-cases?page=1&pageSize=20,/api/domestic-suppliers?page=1&pageSize=20"
$env:LOAD_BEARER_TOKEN = "<test-user-access-token>"
$env:LOAD_REQUESTS = "300"
$env:LOAD_CONCURRENCY = "15"
$env:LOAD_P95_BUDGET_MS = "750"
npm run smoke:load
```

운영 DB에서 쓰기 부하 테스트를 실행하지 않는다. 운영과 동일한 익명화 데이터가 있는 staging 프로젝트를 사용한다.

## 6. DB 점검

```powershell
npx supabase migration list --local
npx supabase db lint --local
npx supabase inspect db table-sizes --local
npx supabase inspect db index-usage --local
```

데이터가 수백만 건이 되어 높은 page offset이 느려지면 외부 API부터 cursor pagination을 추가한다. 화면의 20/50/100 UX는 유지하되 내부 계약은 `created_at + id` cursor를 사용할 수 있다.

## 7. 장애 복구

- CSV·문의·인보이스 재시도는 기존 `idempotency-key`를 유지한다.
- `processing` 상태의 quote export는 lease 만료 후 다른 worker가 다시 claim한다.
- 파일 업로드는 동일 storage path에 upsert하여 재처리 결과가 중복 파일을 만들지 않게 한다.
- DB migration 실패 시 다음 migration으로 임의 보정하지 말고 실패 SQL과 적용 여부를 먼저 확인한다.
- RLS를 꺼서 장애를 우회하지 않는다.

## 8. 정기 점검

- 매 배포: test, typecheck, build, E2E, DB lint
- 매주: 상위 10개 느린 API와 DB 쿼리, queue age, 5xx 비율
- 매월: 테이블/인덱스 크기, 미사용 인덱스, 데이터 보존 기간
- 대규모 캠페인 전: staging 부하 테스트와 worker 동시성 검증
