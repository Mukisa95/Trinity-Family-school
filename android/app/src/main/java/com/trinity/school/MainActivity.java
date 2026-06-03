package com.trinity.school;

import android.os.Build;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.FrameLayout;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    
    @Override
    public void onStart() {
        super.onStart();
        
        // Configure status bar and WebView to respect system windows
        configureStatusBar();
        configureWebViewInsets();
        
        // Inject JavaScript interface to expose status bar height
        setupStatusBarInterface();
    }
    
    /**
     * Configure status bar to be visible and properly positioned
     */
    private void configureStatusBar() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Android 11+ (API 30+)
            getWindow().getInsetsController().setSystemBarsAppearance(
                0, // Light status bar icons
                WindowInsets.Type.statusBars()
            );
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            // Android 6.0+ (API 23+)
            View decorView = getWindow().getDecorView();
            int flags = decorView.getSystemUiVisibility();
            flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR; // Light icons
            decorView.setSystemUiVisibility(flags);
        }
        
        // Make status bar visible
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
    }
    
    /**
     * Configure WebView to respect system window insets (status bar)
     * This mimics Android's "hide camera cutout" behavior - automatically pushes content below status bar
     */
    private void configureWebViewInsets() {
        View decorView = getWindow().getDecorView();
        
        // Get the WebView from Capacitor bridge
        WebView webView = getBridge().getWebView();
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Android 11+ (API 30+) - Use WindowInsets API (same as "hide camera cutout")
            decorView.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
                @Override
                public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
                    // Get status bar insets (same mechanism Android uses for camera cutout)
                    int systemBarsType = WindowInsets.Type.statusBars();
                    android.graphics.Insets statusBarInsets = insets.getInsets(systemBarsType);
                    
                    // Apply padding directly to WebView (like Android does for camera cutout)
                    if (webView != null) {
                        webView.setPadding(
                            webView.getPaddingLeft(),
                            statusBarInsets.top, // Top padding = status bar height
                            webView.getPaddingRight(),
                            webView.getPaddingBottom()
                        );
                    }
                    
                    // Also apply to root content view if it exists
                    ViewGroup rootView = (ViewGroup) decorView;
                    View contentView = rootView.getChildAt(0);
                    if (contentView != null && contentView != webView) {
                        contentView.setPadding(
                            contentView.getPaddingLeft(),
                            statusBarInsets.top,
                            contentView.getPaddingRight(),
                            contentView.getPaddingBottom()
                        );
                    }
                    
                    // Return consumed insets so Android knows we handled them
                    return insets;
                }
            });
        } else {
            // Older Android - Use fitsSystemWindows (automatic padding like camera cutout)
            decorView.setFitsSystemWindows(true);
            
            if (webView != null) {
                // This makes WebView automatically add padding for status bar
                webView.setFitsSystemWindows(true);
            }
        }
    }
    
    /**
     * Setup JavaScript interface to expose status bar height to WebView
     */
    private void setupStatusBarInterface() {
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.addJavascriptInterface(new StatusBarInterface(), "AndroidStatusBar");
        }
    }
    
    /**
     * JavaScript interface to get status bar height
     * Returns height in pixels (not dp)
     */
    public class StatusBarInterface {
        @JavascriptInterface
        public int getStatusBarHeight() {
            int statusBarHeight = 0;
            
            // Method 1: Get from Android system resources (most accurate)
            int resourceId = getResources().getIdentifier("status_bar_height", "dimen", "android");
            if (resourceId > 0) {
                statusBarHeight = getResources().getDimensionPixelSize(resourceId);
                // getDimensionPixelSize already converts dp to px, so we're good
            }
            
            // Method 2: Calculate from window insets (Android 11+)
            if (statusBarHeight == 0 && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                WindowInsets insets = getWindow().getDecorView().getRootWindowInsets();
                if (insets != null) {
                    android.graphics.Insets systemBars = insets.getInsets(WindowInsets.Type.statusBars());
                    statusBarHeight = systemBars.top;
                }
            }
            
            // Method 3: Calculate from system UI visibility (older Android)
            if (statusBarHeight == 0) {
                View decorView = getWindow().getDecorView();
                android.graphics.Rect rect = new android.graphics.Rect();
                decorView.getWindowVisibleDisplayFrame(rect);
                statusBarHeight = rect.top;
            }
            
            // Fallback: Default status bar height (24dp converted to px)
            if (statusBarHeight == 0) {
                float density = getResources().getDisplayMetrics().density;
                statusBarHeight = (int) (24 * density); // 24dp is standard
            }
            
            // Ensure we don't return an unreasonably large value
            // Status bar is typically 24-48px on most devices
            if (statusBarHeight > 100) {
                statusBarHeight = (int) (24 * getResources().getDisplayMetrics().density);
            }
            
            return statusBarHeight;
        }
    }
}
