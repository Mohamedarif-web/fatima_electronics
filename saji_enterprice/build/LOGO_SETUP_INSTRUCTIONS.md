# 📱 App Logo Setup Instructions

## 🎨 Required Icon Files for Building

To build your app with custom logos, you need to create these icon files in the `build/` folder:

### **Windows (EXE)**
- `icon.ico` - 256x256 pixels (or contains multiple sizes: 16, 32, 48, 64, 128, 256)

### **Mac (DMG)**  
- `icon.icns` - Mac icon format (contains multiple sizes)
- `dmg-background.png` - 540x380 pixels (optional, for DMG installer background)

### **Linux (AppImage)**
- `icon.png` - 512x512 pixels

## 🛠️ How to Create Icons

### **Option 1: Online Icon Converters**
1. Create a high-quality PNG logo (1024x1024 pixels)
2. Use online converters:
   - **ICO**: https://convertio.co/png-ico/
   - **ICNS**: https://cloudconvert.com/png-to-icns
   - **PNG**: Resize to 512x512

### **Option 2: Using ImageMagick (Command Line)**
```bash
# Install ImageMagick first
# For ICO (Windows)
magick your-logo.png -resize 256x256 build/icon.ico

# For PNG (Linux)
magick your-logo.png -resize 512x512 build/icon.png

# For ICNS (Mac) - requires special tools
png2icns build/icon.icns your-logo.png
```

### **Option 3: Manual Creation**
1. **Windows ICO**: Use GIMP or online tools to create .ico file
2. **Mac ICNS**: Use Xcode or online converters
3. **Linux PNG**: Any image editor, save as 512x512 PNG

## 📁 File Structure
```
saji_enterprice/
├── build/
│   ├── icon.ico          ← Windows icon
│   ├── icon.icns         ← Mac icon  
│   ├── icon.png          ← Linux icon
│   ├── dmg-background.png ← Mac DMG background (optional)
│   └── entitlements.mac.plist ← Already created
```

## 🚀 Quick Setup Script

Create a 1024x1024 PNG logo named `logo.png` in the build folder, then run:

```bash
# Navigate to build folder
cd saji_enterprice/build

# Convert to required formats (requires ImageMagick)
magick logo.png -resize 256x256 icon.ico
magick logo.png -resize 512x512 icon.png

# For Mac ICNS, use online converter or:
# png2icns icon.icns logo.png
```

## ⚠️ Important Notes

- **High Quality**: Start with a high-resolution logo (1024x1024 or larger)
- **Square Format**: Icons should be square (same width and height)
- **Transparent Background**: PNG format with transparent background works best
- **Simple Design**: Icons look best when simple and clear at small sizes

## 🎯 Quick Test

Once you have your icon files, you can test the build:

```bash
# Test Windows build
npm run build:win

# Test Mac build  
npm run build:mac

# Test all platforms
npm run dist
```

Your custom logo will appear on:
- Desktop shortcuts
- Taskbar/Dock
- App title bars
- Installer windows
- File associations