# 🚀 Saji Enterprises - Build Guide

## 📦 Build Your Desktop App (EXE & Mac)

### **🔧 Prerequisites**
- Node.js installed (v16 or higher)
- All dependencies installed: `npm install`

### **🎨 Step 1: Setup Your Logo**

#### Option A: Use Default Logo (For Testing)
```bash
# Create a default "S" logo
node build/create-default-icon.js

# Convert to required formats using online tools:
# - Upload build/default-icon.svg to https://convertio.co/
# - Convert to ICO, ICNS, and PNG formats
# - Save as build/icon.ico, build/icon.icns, build/icon.png
```

#### Option B: Use Your Custom Logo
1. Create a high-quality square logo (1024x1024 PNG)
2. Convert to required formats:
   - **Windows**: `icon.ico` (256x256)
   - **Mac**: `icon.icns` (Mac format)
   - **Linux**: `icon.png` (512x512)
3. Save all files in `build/` folder

### **🏗️ Step 2: Build Commands**

#### Build for Windows (EXE)
```bash
npm run build:win
```
**Output**: `dist/Saji Enterprises Setup.exe`

#### Build for Mac (DMG)
```bash
npm run build:mac
```
**Output**: `dist/Saji Enterprises.dmg`

#### Build for Linux (AppImage)
```bash
npm run build:linux
```
**Output**: `dist/Saji Enterprises.AppImage`

#### Build for All Platforms
```bash
npm run dist
```

### **📁 Build Outputs**

After building, you'll find installers in the `dist/` folder:

```
dist/
├── Saji Enterprises Setup.exe    ← Windows installer
├── Saji Enterprises.dmg          ← Mac installer
├── Saji Enterprises.AppImage     ← Linux installer
└── latest.yml                    ← Update metadata
```

### **🎯 Distribution**

#### Windows (EXE)
- **File**: `Saji Enterprises Setup.exe`
- **Installer**: NSIS installer with desktop shortcut
- **User Experience**: Double-click to install, creates Start Menu entry

#### Mac (DMG)
- **File**: `Saji Enterprises.dmg`  
- **Installer**: Drag & drop to Applications folder
- **User Experience**: Mount DMG, drag app to Applications

#### Linux (AppImage)
- **File**: `Saji Enterprises.AppImage`
- **Usage**: Make executable and run directly
- **User Experience**: `chmod +x` then double-click

### **🔍 Testing Your Build**

1. **Test the EXE**:
   ```bash
   # Run the installer
   ./dist/Saji\ Enterprises\ Setup.exe
   ```

2. **Test the Mac DMG**:
   ```bash
   # Mount and test (on Mac)
   open ./dist/Saji\ Enterprises.dmg
   ```

3. **Test Database Backups**:
   - Install and run the app
   - Create some test data
   - Check backup locations:
     - Windows: `%APPDATA%/saji-enterprice/backups/`
     - Mac: `~/Library/Application Support/saji-enterprice/backups/`

### **📊 App Features in Built Version**

✅ **Complete Business Management System**
- Sales & Purchase Invoices
- Customer & Supplier Management  
- Inventory & Stock Management
- Payment Tracking
- Business Reports
- GST Invoice Generation

✅ **Automatic Database Backups**
- Every 10 minutes automatically
- Multiple backup locations
- 15+ backup copies maintained
- Data corruption protection

✅ **Professional Installation**
- Custom app icon
- Desktop shortcuts
- Start menu integration
- Clean uninstaller

### **🚨 Important Build Notes**

#### **Database Location** (For Users):
- **Windows**: `C:\Users\[Username]\AppData\Roaming\saji-enterprice\`
- **Mac**: `~/Library/Application Support/saji-enterprice/`
- **Linux**: `~/.config/saji-enterprice/`

#### **Backup Locations**:
- **Primary**: Same folder as database
- **Secondary**: Documents/SajiEnterprises_Backup/
- **Tertiary**: Desktop/SajiBackup/

#### **Code Signing** (Optional):
For production distribution, consider code signing:
- **Windows**: Get a code signing certificate
- **Mac**: Apple Developer ID required
- **Linux**: No signing required

### **📈 Build Optimization**

#### Reduce Build Size:
```bash
# Clean build
npm run clean
npm run build:web
npm run dist
```

#### Debug Build Issues:
```bash
# Verbose build output
DEBUG=electron-builder npm run dist
```

### **🔄 Auto-Updates** (Future)

Your app is configured for auto-updates. To enable:
1. Setup a release server
2. Configure update URLs in build config
3. Users will get automatic update notifications

### **💡 Pro Tips**

1. **Test on Target Platform**: Always test builds on the actual OS
2. **Icon Quality**: Use high-resolution icons for crisp appearance
3. **File Associations**: Configure file types your app should handle
4. **Performance**: Optimize for startup time and memory usage
5. **Security**: Consider code signing for user trust

---

## 🎉 Your App is Now Ready for Distribution!

Share the installer files with your users. They'll get:
- Professional installation experience
- Automatic database backups
- Complete business management system
- No technical setup required

**Support**: Users just double-click the installer and start using immediately!