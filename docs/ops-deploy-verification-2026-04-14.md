# CareerFlow AI 운영 반영 및 재검증 기록 (2026-04-14 UTC)

## 1. 반영 전 상태

- 작업 경로: `/opt/careerflow-ai/careerflow-ai/backend`
- 현재 브랜치: `main`
- 반영 전 HEAD: `aa29063`
- `origin/main` 상태: `6698999`까지 behind 11
- PM2 상태: `careerflow-backend` online
- 반영 전 핵심 이슈:
  - 운영 서버에서 follow-up duplicate skip 실패
  - 동일 의미 answers를 역순 재제출해도 `REGENERATE_CANDIDATE`와 `DETECT_GAP`가 다시 실행됨

## 2. 반영 과정

### 기준점 기록

- `pwd` 확인
- `git status --short --branch`
- `git branch -vv`
- `git rev-parse --short HEAD`
- `pm2 list`

### 롤백 포인트 확보

- 롤백 브랜치 생성:
  - `backup/pre-6698999-aa29063-20260414`
- `deploy-ec2.sh` 보존:
  - 파일 백업: `/tmp/careerflow-backups/deploy-ec2.sh.pre-6698999-<timestamp>`
  - patch 백업: `/tmp/careerflow-backups/deploy-ec2.sh.pre-6698999.patch`
  - stash 생성: `stash@{0}` with message `preserve deploy-ec2.sh before 6698999 deploy`

주의:

- `deploy-ec2.sh`는 pull 전에 stash/backup으로 보존했다.
- 반영 후에는 `git stash apply stash@{0}`로 작업트리에 다시 복원했다.
- stash 엔트리는 남겨 두어 추가 롤백 근거도 유지했다.

### 최신 코드 반영

- 실행 명령:
  - `git pull --ff-only origin main`
- 결과:
  - `aa29063 -> 6698999` fast-forward
- 반영 후 HEAD:
  - `6698999 feat: add benchmark workflow and fix duplicate follow-up skip`

### build / reload

- backend build:
  - `npm run build`
- process reload:
  - `pm2 reload careerflow-backend`
- reload 후 PM2 상태:
  - PID: `2129991`
  - uptime: 약 `3m`
  - restart count: `1`
  - status: `online`

## 3. 반영 후 커밋/프로세스 상태

- 현재 HEAD: `6698999`
- 현재 브랜치 상태: `main...origin/main`
- 작업트리:
  - `deploy-ec2.sh` 수정 상태 복원됨
  - `docs/ops-verification-2026-04-14.md` untracked
- PM2:
  - `careerflow-backend` online
  - `lms-api`와 분리 유지

## 4. 재검증 결과

테스트 방식:

- 테스트 사용자 1명 생성
- 테스트 application 1개 생성
- 고비용 구간은 최소 호출만 사용
- 운영 데이터 대신 test user 전용 workflow만 사용

### analysis/run lock 재검증

동일 `applicationId`로 동시 2회 호출

| 호출 | 상태 | 시간 |
| --- | --- | --- |
| 1차 | `201` | `72,537.3ms` |
| 2차 | `409` | `11.1ms` |

확인 내용:

- 1회는 정상 실행
- 다른 1회는 즉시 `409`
- 메시지: `Workflow stage is already running: analysis:37`

판단:

- 운영 반영 후에도 lock 보호 장치는 정상 유지됨

### follow-up duplicate skip 재검증

동일 의미 answers를 1차 제출 후, 역순으로 재제출

| 호출 | 상태 | 시간 |
| --- | --- | --- |
| 1차 제출 | `201` | `3,951.0ms` |
| 역순 재제출 | `201` | `8.7ms` |

최종 `workflowRuns` 확인:

- `REGENERATE_CANDIDATE` 총 2회
  - 1회는 정상 실행
  - 1회는 `SKIPPED_DUPLICATE_FOLLOWUP_ANSWERS`
- `DETECT_GAP` 총 2회
  - analysis 1회
  - follow-up 최초 제출 1회
  - duplicate 재제출로 인한 추가 `DETECT_GAP` 없음

판단:

- 이번 반영의 핵심 수정사항이 운영 서버에 실제 적용되었다.
- 수정 전 운영 서버에서는 duplicate 재제출이 약 `2.69초` 동안 다시 실행됐지만,
- 수정 후에는 `8.7ms`로 skip 처리됐다.

### generated-documents 재검증

| 호출 | 상태 | 시간 |
| --- | --- | --- |
| 최초 생성 | `201` | `16,040.1ms` |
| 재호출 | `201` | `10.1ms` |

최종 `workflowRuns`:

- `GENERATE_DRAFTS` 총 2회
  - 1회 정상 실행
  - 1회 `SKIPPED_REUSE_EXISTING_DOCUMENTS`

### interview 재검증

| 호출 | 상태 | 시간 |
| --- | --- | --- |
| 최초 생성 | `201` | `29,774.8ms` |
| 재호출 | `201` | `13.5ms` |

최종 `workflowRuns`:

- `GENERATE_INTERVIEW` 총 2회
  - 1회 정상 실행
  - 1회 `SKIPPED_REUSE_EXISTING_INTERVIEW`

## 5. 트래픽 테스트 결과

운영 부담을 줄이기 위해 burst 테스트는 `source-documents`에만 제한적으로 수행했다.

### source-documents

#### 순차 5회

- 평균 응답시간: `17.8ms`
- p95: `37.2ms`
- 최소: `11.3ms`
- 최대: `37.2ms`
- 실패: `0`

#### 동시 8회 burst

- 성공: `8/8`
- 평균 응답시간: `70.2ms`
- p95: `81.5ms`
- 최소: `34.1ms`
- 최대: `81.5ms`
- 배치 시간: `91.0ms`
- 대략적 처리량: `87.91 req/s`

해석:

- 운영 서버 기준에서도 `source-documents`는 낮은 부하에서 충분히 가볍게 처리됐다.
- 이번 서비스의 성능 병목은 ingress 저장이 아니라 이후 AI 워크플로우 단계다.

### analysis/run

- 단일 실행 시간: `72.5초`
- 동시 요청 보호:
  - 두 번째 요청은 `11.1ms` 만에 `409`

### follow-up

- 최초 제출: `3.95초`
- duplicate 역순 재제출: `8.7ms`
- 결과:
  - 이번에는 재실행이 아니라 skip

### documents / interview

- documents 최초: `16.0초`
- documents 재호출: `10.1ms`
- interview 최초: `29.8초`
- interview 재호출: `13.5ms`

## 6. 확인된 개선점

### 1. duplicate follow-up skip fix가 운영에서 실제 반영됨

수정 전:

- duplicate 재제출 시 약 `2.69초`
- `REGENERATE_CANDIDATE`, `DETECT_GAP` 재실행

수정 후:

- duplicate 재제출 시 `8.7ms`
- `SKIPPED_DUPLICATE_FOLLOWUP_ANSWERS` 기록
- 추가 `DETECT_GAP` 없음

### 2. 기존 보호 장치는 그대로 유지됨

- analysis 동시 호출 lock 유지
- documents/interview 재사용 skip 유지
- workflow metadata 기록 유지

### 3. reload 이후 실제 런타임 반영이 확인됨

- PM2 reload 후 새 PID로 기동
- 후속 API 동작이 `6698999`의 수정 결과와 일치

## 7. 남은 리스크

### 1. 전체 분석 시간은 여전히 길다

- `analysis/run`이 약 `72.5초`
- documents/interview도 각각 `16초`, `29.8초`
- 사용자 경험상 실시간형보다 단계형 워크플로우에 더 적합

### 2. lock / rate limit이 인메모리 기반

코드상 `WorkflowExecutionLockService`와 `RequestRateLimiterService`는 프로세스 메모리 기반이다.

의미:

- 현재처럼 PM2 단일 인스턴스에서는 유효
- 향후 다중 인스턴스나 수평 확장 시에는 Redis 등 외부 공유 저장소 기반으로 옮겨야 함

### 3. 이번 트래픽 테스트는 보수적 범위에 한정

- 운영 영향 최소화를 위해 sustained load는 수행하지 않음
- `source-documents`만 제한적 burst
- `analysis/documents/interview`는 안정성 중심으로 최소 호출만 검증

## 8. 포트폴리오용 핵심 문장

- 운영 중인 AI 백엔드에 최신 수정사항을 직접 반영하고, duplicate follow-up skip 버그가 실제 운영 환경에서 `2.69초 재실행 -> 8.7ms skip`으로 개선되는 것을 검증했다.
- 단순 TPS가 아니라 `중복 실행 방지`, `고비용 LLM 재사용`, `과호출 차단`, `워크플로우 메타데이터 추적`이 실제로 동작하는지 운영 서버 기준으로 확인했다.
- 동일 분석 요청의 동시 호출은 운영 서버에서 `11.1ms` 만에 `409`로 차단됐고, 문서/면접 생성은 최초 실행 이후 각각 `16.0초 -> 10.1ms`, `29.8초 -> 13.5ms`로 재사용됐다.
- 문제를 로컬에서만 고친 것이 아니라, EC2 운영 환경에 안전하게 반영하고 build/reload 후 재검증까지 완료한 경험으로 설명할 수 있다.
- 이 프로젝트는 AI 기능 구현을 넘어, 실제 운영 비용과 중복 실행을 통제하는 워크플로우 설계와 검증까지 수행한 사례다.
