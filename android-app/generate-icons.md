# 🎨 App Icon Generation Guide

## Quick Icon Generation Tools

### Option 1: Online Icon Generators
1. **Android Asset Studio**: https://romannurik.github.io/AndroidAssetStudio/icons-launcher.html
2. **App Icon Generator**: https://appicon.co/
3. **MakeAppIcon**: https://makeappicon.com/

### Option 2: Android Studio
1. Right-click on `res` folder
2. New → Image Asset
3. Launcher Icons
4. Upload your 512x512 image
5. Generate all sizes automatically

## Icon Requirements

### Sizes Needed:
- **48x48 px** → `mipmap-mdpi/ic_launcher.png`
- **72x72 px** → `mipmap-hdpi/ic_launcher.png`
- **96x96 px** → `mipmap-xhdpi/ic_launcher.png`
- **144x144 px** → `mipmap-xxhdpi/ic_launcher.png`
- **192x192 px** → `mipmap-xxxhdpi/ic_launcher.png`

### Design Guidelines:
- **Simple and recognizable** at small sizes
- **High contrast** for visibility
- **Square design** (will be automatically rounded)
- **No text** (hard to read at small sizes)
- **Transparent background** (PNG format)

## Current Icon Structure

Your app uses **Adaptive Icons** which have:
- **Background layer**: Solid color or gradient
- **Foreground layer**: Your main icon design

## Customization Options

### 1. Change Background Color
Edit the `android:fillColor` in the background path:
```xml
<path
    android:fillColor="#YOUR_COLOR_HERE"
    android:pathData="M0,0h108v108h-108z"/>
```

### 2. Replace Icon Design
Replace the foreground paths with your custom SVG paths.

### 3. Use PNG Icons
Replace the XML files with PNG images in each mipmap folder.

## Testing Your Icon

1. **Build and install** the app
2. **Check different screen densities** on various devices
3. **Verify visibility** in app drawer and home screen
4. **Test in different themes** (light/dark mode)

## Troubleshooting

### Icon Not Updating:
1. **Clean and rebuild** the project
2. **Uninstall and reinstall** the app
3. **Clear app data** on device
4. **Check file names** match exactly

### Icon Looks Blurry:
1. **Use higher resolution** source images
2. **Generate all density sizes** properly
3. **Avoid scaling up** small images

### Icon Too Small/Large:
1. **Adjust viewport** in XML files
2. **Check padding** and margins
3. **Verify adaptive icon** settings
