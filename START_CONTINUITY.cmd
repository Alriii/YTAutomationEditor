@echo off
setlocal
cd /d "%~dp0"

echo.
echo Continuity Studio - Free Local Mode
echo ===================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js 24 or newer is required.
  echo Install Node.js, then run this file again.
  pause
  exit /b 1
)

where docker >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Docker Desktop / Docker Engine is required.
  echo Install Docker and make sure it is running.
  pause
  exit /b 1
)

docker info >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Docker is installed but not running.
  echo Start Docker Desktop, wait until it is ready, then try again.
  pause
  exit /b 1
)

where pnpm >nul 2>nul
if errorlevel 1 (
  where corepack >nul 2>nul
  if errorlevel 1 (
    echo [ERROR] pnpm was not found and Corepack is unavailable.
    echo Install pnpm 10+, then try again.
    pause
    exit /b 1
  )

  echo Enabling pnpm through Corepack...
  call corepack enable
  if errorlevel 1 (
    echo [ERROR] Could not enable pnpm.
    pause
    exit /b 1
  )
)

if not exist "node_modules" (
  echo Installing project dependencies...
  call pnpm install --no-frozen-lockfile
  if errorlevel 1 (
    echo [ERROR] Dependency installation failed.
    pause
    exit /b 1
  )
)

echo Starting Continuity Studio...
echo.
call pnpm local:dev

if errorlevel 1 (
  echo.
  echo Continuity Studio stopped because of an error.
  pause
  exit /b 1
)

endlocal
