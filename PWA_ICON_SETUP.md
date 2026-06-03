# PWA Icon Setup Guide

## Overview

This guide explains how the custom PWA icons are configured for the Trinity School Online application using the "Budge C.png" logo.

## Current Configuration

### Icon Files Generated

All icons are automatically generated from `Budge C.png` in the project root:

1. **PWA Icons** (in `/public/`)
   - `icon-192.png` (192×192) - Used for PWA installation
   - `icon-512.png` (512×512) - Used for PWA installation

2. **Additional Icons** (in `/public/icons/`)
   - `badge-72x72.png` (72×72) - Badge icon
   - `icon-192x192.png` (192×192) - Alternative icon
   - `icon-512x512.png` (512×512) - Alternative icon

3. **Favicons** (in `/public/`)
   - `favicon.ico` - Browser tab icon
   - `favicon.png` (32×32) - PNG favicon
   - `favicon-16x16.png` (16×16) - Small favicon

4. **Apple Touch Icon** (in `/public/`)
   - `apple-touch-icon.png` (180×180) - iOS home screen icon

### Manifest Configuration

The `public/manifest.json` file references these icons:

```json
{
  "name": "Trinity School Online - School Management System",
  "short_name": "Trinity School",
  "icons": [
    {
      "src": "/favicon.ico",
      "sizes": "16x16 32x32",
      "type": "image/x-icon"
    },
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

### HTML Head Configuration

The `src/app/layout.tsx` file includes the following icon references:

```tsx
<head>
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="icon" href="/favicon.png" type="image/png" sizes="32x32" />
  <link rel="icon" href="/favicon-16x16.png" type="image/png" sizes="16x16" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
  <link rel="manifest" href="/manifest.json" />
  <meta name="theme-color" content="#000000" />
</head>
```

## How to Update the PWA Icon

### Method 1: Using the NPM Script (Recommended)

1. Replace `Budge C.png` in the project root with your new logo
2. Run the icon generation script:

```bash
npm run generate-icons
```

This will automatically generate all required icon sizes.

### Method 2: Manual Generation

1. Replace `Budge C.png` with your new logo
2. Run the script directly:

```bash
node scripts/generate-all-icons.js
```

## After Updating Icons

To see the new icons in your PWA:

1. **Clear Browser Cache**
   - Chrome: Press `Ctrl+Shift+Delete` (Windows) or `Cmd+Shift+Delete` (Mac)
   - Select "Cached images and files"
   - Click "Clear data"

2. **Uninstall the PWA** (if already installed)
   - Chrome: Go to `chrome://apps/`
   - Right-click on "Trinity School Online"
   - Select "Remove from Chrome"

3. **Reload the Website**
   - Visit your application URL
   - Press `Ctrl+F5` (Windows) or `Cmd+Shift+R` (Mac) for a hard reload

4. **Reinstall the PWA**
   - Click the install button in the address bar
   - Or use the "Install" option in the browser menu

## Icon Requirements

When replacing `Budge C.png`, ensure your logo:

- Is a PNG file with transparency (optional)
- Has a square aspect ratio (1:1) or will be centered in a square
- Has a minimum resolution of 512×512 pixels (higher is better)
- Has good contrast and is clearly visible at small sizes

## Technical Details

### Icon Generation Process

The `scripts/generate-all-icons.js` script:

1. Reads the source image (`Budge C.png`)
2. Resizes it to multiple sizes using the `sharp` library
3. Applies a white background (for transparency)
4. Saves each size to the appropriate location
5. Copies the favicon.png to favicon.ico

### Dependencies

The icon generation requires:

- `sharp` - Image processing library
- Node.js - JavaScript runtime

These are already included in the project's `devDependencies`.

## Troubleshooting

### Icons Not Updating

If the new icons don't appear:

1. **Check Service Worker**: The service worker might be caching old icons
   - Go to `chrome://serviceworker-internals/`
   - Find your app and click "Unregister"
   - Reload the page

2. **Check Browser Cache**: Ensure you've cleared the cache completely

3. **Check File Paths**: Verify all icon files exist in the `public` folder

4. **Check Manifest**: Ensure `manifest.json` hasn't been modified

### Icons Look Distorted

If icons appear stretched or distorted:

1. Ensure your source image (`Budge C.png`) has a square aspect ratio
2. The script uses `fit: 'contain'` which preserves aspect ratio
3. Check that the source image is high quality (at least 512×512)

### PWA Not Installing

If the PWA won't install:

1. Check that the manifest.json is valid
2. Ensure the app is served over HTTPS (or localhost)
3. Verify that at least one icon is 192×192 or larger
4. Check browser console for errors

## Platform-Specific Notes

### Windows

- The PWA will use `icon-192.png` or `icon-512.png`
- Desktop shortcut will show the icon

### macOS

- Uses the same icons as Windows
- Dock icon will display the PWA icon

### Android

- Uses icons from the manifest
- Home screen icon will be `icon-192.png` or `icon-512.png`
- Supports "maskable" icons (adaptive icons)

### iOS

- Uses `apple-touch-icon.png` (180×180)
- Home screen icon will be rounded by iOS
- No transparency support (white background is applied)

## Additional Resources

- [Web App Manifest Specification](https://www.w3.org/TR/appmanifest/)
- [PWA Icon Guidelines](https://web.dev/add-manifest/)
- [Sharp Documentation](https://sharp.pixelplumbing.com/)

## Support

If you encounter issues with the PWA icons, check:

1. Browser console for errors
2. Network tab for failed icon requests
3. Manifest validation tools
4. Service worker status

---

**Last Updated**: December 21, 2025
**Maintained By**: Trinity School Online Development Team

