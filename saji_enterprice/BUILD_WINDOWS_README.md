
# Windows Build Instructions for Fatima Electronics

## Quick Build Steps:

### Option 1: Use Batch File (Easiest)
1. **Double-click** build-windows.bat
2. **Wait for build** to complete
3. **Check dist/** folder for output

### Option 2: Command Line  
```cmd
# Run as Administrator (recommended)
npm run build:win
```

### Option 3: Fast Build (No compression)
```cmd  
npm run build:win:fast
```

## Build Output:
- **Installer:** dist/Fatima Electronics Setup 1.0.0.exe
- **Portable:** dist/win-unpacked/Fatima Electronics.exe

## Icon Setup (Optional):
1. Convert build/icon.svg to .ico format online
2. Save as build/icon.ico
3. Rebuild for custom icon

## Notes:
- SQLite3 rebuild issues bypassed
- Builds x64 Windows executable
- No administrator privileges required for install
- Creates desktop and start menu shortcuts

Ready to build! 🚀

