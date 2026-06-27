@echo off
set ROOT=%~dp0
set PNPM=C:\Users\evtsa\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd
set NODEBIN=C:\Users\evtsa\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin
set PATH=%NODEBIN%;%PATH%
cd /d "%ROOT%"
start "EV SEA GUARD AI" cmd /k "%PNPM% exec vite --host 127.0.0.1 --port 5177"
timeout /t 3 >nul
start "" "http://127.0.0.1:5177"
