# Agent Rules (Single Source)

이 문서는 현재 저장소의 **실행/운영 규칙 단일 기준 문서**다.

## 1) 서버 실행 원칙
1. 백엔드/프론트 dev 서버를 무작정 새로 실행하지 않는다.
2. 실행 전 목표 포트 점유 여부를 반드시 확인한다.
3. 포트가 이미 점유된 경우:
   - 정상 서버면 재사용
   - 비정상 프로세스면 종료 후 재기동
4. 동일 서버 중복 세션 실행 금지
5. 같은 실패 명령 반복 금지 (원인 진단 우선)

## 2) 포트 규칙
- Backend: `4000`
- Frontend: `3000`

실행 전 확인:
```bash
netstat -ano | findstr :4000
netstat -ano | findstr :3000
```

PID 종료:
```bash
cmd.exe /c "taskkill /PID 26500 /F"
```

## 3) 런타임 이슈 기록 규칙
런타임 문제 발생 시 `docs/troubleshooting.md`에 아래 4가지를 반드시 기록:
- issue
- cause
- fix
- prevention rule

## 4) 문서 운영 규칙
- 구현되지 않은 기능은 문서에 단정 표현으로 쓰지 않는다.
- 포트폴리오 문구는 "현재 구현"과 "향후 계획"을 분리한다.
- 성능/운영 지표는 `docs/performance-metrics.md`를 단일 지표 문서로 관리한다.