#!/bin/bash
cd backend

echo "========================================"
echo "Starting Backend Setup & Execution..."
echo "========================================"

# Try to find a python executable
PYTHON_CMD="python3"
if ! command -v $PYTHON_CMD &> /dev/null; then
    PYTHON_CMD="python"
fi

if ! command -v $PYTHON_CMD &> /dev/null; then
    echo "Error: Python is not installed or not in PATH."
    exit 1
fi

# Create venv if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    $PYTHON_CMD -m venv venv
fi

# Activate venv
echo "Activating virtual environment..."
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
elif [ -f "venv/Scripts/activate" ]; then
    # Used if running bash on Windows
    source venv/Scripts/activate
else
    echo "Error: Could not find virtual environment activation script."
    exit 1
fi

echo "Installing backend dependencies..."
pip install -r requirements.txt

echo "Starting backend server..."
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
