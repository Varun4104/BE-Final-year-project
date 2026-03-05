@echo off
cd backend

echo ========================================
echo Starting Backend Setup ^& Execution...
echo ========================================

if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)

echo Activating virtual environment...
if exist venv\Scripts\activate.bat (
    call venv\Scripts\activate.bat
) else if exist venv\bin\activate.bat (
    call venv\bin\activate.bat
) else (
    echo Error: Could not find virtual environment activation script. 
    echo Ensure Python is installed and added to your PATH.
    exit /b 1
)

echo Installing backend dependencies...
pip install -r requirements.txt

echo Starting backend server...
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
