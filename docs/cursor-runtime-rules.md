# Cursor Runtime Rules (Mandatory)

From now on, these are mandatory execution rules for this repository.

## 1) Server start discipline
1. Never start backend/frontend dev server blindly.
2. Always check target port first.
3. If port is occupied:
   - verify if the running process is the correct healthy server
   - reuse it if healthy
   - otherwise stop it before restart
4. Never run duplicate backend/frontend server sessions.
5. Never retry the same failing command repeatedly without root-cause diagnosis.

## 2) Project port rules
- Backend default port: `4000`
- Frontend default port: `3000`

Before backend start: check `4000` first.  
Before frontend start: check `3000` first.

## 3) Windows/Git Bash commands
### Port check
```bash
netstat -ano | findstr :4000
netstat -ano | findstr :3000
```

### Kill by PID (preferred)
```bash
cmd.exe /c "taskkill /PID 26500 /F"
```

### Alternative
```bash
taskkill //PID 26500 //F
```

## 4) Runtime issue documentation rule
For every runtime issue, immediately update `docs/troubleshooting.md` with:
- issue
- cause
- fix
- prevention rule
