#!/bin/bash
cd frontend

echo "========================================"
echo "Starting Frontend Setup & Execution..."
echo "========================================"

if command -v pnpm &> /dev/null; then
    echo "Installing frontend dependencies using pnpm..."
    pnpm install
    echo "Starting frontend development server..."
    pnpm run dev
elif command -v npm &> /dev/null; then
    echo "Installing frontend dependencies using npm..."
    npm install
    echo "Starting frontend development server..."
    npm run dev
else
    echo "Error: Neither pnpm nor npm could be found. Please install Node.js and a package manager."
    exit 1
fi
