# Cursor Runtime Rules

## Core Rules
1. Do not start a new dev server if one is already running.
2. Before starting frontend or backend, always check whether the target port is already in use.
3. If the port is already in use, identify the existing process and either:
   - reuse the running server if healthy
   - or stop the old process before starting a new one
4. Never open multiple duplicate terminal sessions for the same backend/frontend dev server.
5. Do not repeatedly retry the same failing command without first diagnosing the cause.
6. When an environment/runtime issue occurs, record:
   - symptom
   - root cause
   - fix
   - prevention rule
   in `docs/troubleshooting.md`.

## Backend Port Rules
- Default backend port: 4000
- Before running backend, always check port 4000 usage.
- If port 4000 is occupied, do not blindly run another backend instance.

## Frontend Port Rules
- Default frontend port: 3000
- Before running frontend, always check port 3000 usage.
- If port 3000 is occupied, do not blindly run another frontend instance.

## Safe Run Checklist
Before running any dev server:
1. Check port usage
2. Confirm whether an existing healthy process is already serving
3. Start only one instance
4. Record any runtime issue in troubleshooting docs