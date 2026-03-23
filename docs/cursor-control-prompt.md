# Cursor 제어 프롬프트 (산으로 갈 때 즉시 사용)

아래 프롬프트를 그대로 붙여넣어 제어한다.

```text
Do not overengineer.
Do not add unnecessary features.
Do not turn this into a chatbot.
Do not make it a toy writing app.
Build a real AI workflow product for job application automation.
Prioritize shipping a working, deployable MVP in 7 days.
```

## 사용 타이밍
- 설명만 길고 파일 생성이 없을 때
- 챗봇형 UX/기능으로 흐를 때
- MVP 범위를 벗어난 기능을 추가하려고 할 때

## 강제 체크 기준
- 설명보다 파일 생성
- `docs/*.md` 실제 생성/업데이트
- `backend` 구조 및 코드 생성
- `prisma/schema.prisma`, `.env.example`, 모듈 파일 확인
