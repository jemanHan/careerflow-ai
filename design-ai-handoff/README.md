# 디자인 AI 전달 패키지

- **`DESIGN_PROMPT_KO.md`** — 디자인 도우미에 그대로 붙여 넣을 프롬프트 + 페이지 설명 표
- **`FILES_INCLUDED.txt`** — `ui/` 폴더 구성 설명
- **`ui/`** — 프론트에서 디자인에 쓰는 파일만 복사한 스냅샷

## `ui/` 폴더 갱신

프로젝트 루트에서:

```powershell
.\design-ai-handoff\sync-ui.ps1
```

## 압축 파일 만들기 (Windows PowerShell)

`ui/` 동기화 후, 프로젝트 루트에서:

```powershell
Compress-Archive -Path "design-ai-handoff" -DestinationPath "careerflow-ai-design-handoff.zip" -Force
```

생성된 `careerflow-ai-design-handoff.zip`을 디자인 AI에 첨부하고, `DESIGN_PROMPT_KO.md`의 **[여기부터 복사] ~ [여기까지 복사]** 구간을 본문에 붙여 넣으면 됩니다.

## 스냅샷 갱신

`frontend/`의 레이아웃·컴포넌트를 바꾼 뒤에는 `ui/`를 다시 맞춰야 합니다. 수동 복사 또는 팀 내 스크립트로 동기화하세요.
