@echo off
cd frontend

echo ========================================
echo Starting Frontend Setup ^& Execution...
echo ========================================

where pnpm >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo Installing frontend dependencies using pnpm...
    call pnpm install
    echo Starting frontend development server...
    call pnpm run dev
) else (
    where npm >nul 2>nul
    if %ERRORLEVEL% equ 0 (
        echo Installing frontend dependencies using npm...
        call npm install
        echo Starting frontend development server...
        call npm run dev
    ) else (
        echo Error: Neither pnpm nor npm could be found. Please install Node.js and a package manager.
        exit /b 1
    )
)
