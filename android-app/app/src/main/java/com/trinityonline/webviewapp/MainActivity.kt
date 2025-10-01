package com.trinityonline.webviewapp

import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import android.view.View
import android.view.ViewGroup
import android.view.Gravity
import android.webkit.*
import android.util.Log
import android.widget.Button
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.trinityonline.webviewapp.databinding.ActivityMainBinding
import com.trinityonline.webviewapp.utils.NetworkUtils
import java.io.File
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : AppCompatActivity() {
    
    private lateinit var binding: ActivityMainBinding
    private val WEB_APP_URL = "https://trinityfamilyschool.vercel.app/"
    
    // Permission manager
    private lateinit var permissionManager: PermissionManager
    
    // Camera and file upload related properties
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var photoUri: Uri? = null
    private var currentPhotoPath: String? = null
    
    // Permission request launcher
    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted: Boolean ->
        if (isGranted) {
            // Permission granted, proceed with camera action
            openCamera()
        } else {
            // Permission denied
            Toast.makeText(this, "Camera permission is required for this feature", Toast.LENGTH_SHORT).show()
            filePathCallback?.onReceiveValue(null)
            filePathCallback = null
        }
    }
    
    // Camera result launcher
    private val cameraLauncher = registerForActivityResult(
        ActivityResultContracts.TakePicture()
    ) { success ->
        if (success && photoUri != null) {
            filePathCallback?.onReceiveValue(arrayOf(photoUri!!))
        } else {
            filePathCallback?.onReceiveValue(null)
        }
        filePathCallback = null
        photoUri = null
    }
    
    // Gallery result launcher
    private val galleryLauncher = registerForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri ->
        if (uri != null) {
            filePathCallback?.onReceiveValue(arrayOf(uri))
        } else {
            filePathCallback?.onReceiveValue(null)
        }
        filePathCallback = null
    }
    
    // Check if WhatsApp is installed
    private fun isWhatsAppInstalled(): Boolean {
        val whatsappPackages = listOf(
            "com.whatsapp",
            "com.whatsapp.w4b",
            "com.whatsapp.business"
        )
        
        for (packageName in whatsappPackages) {
            try {
                val packageInfo = packageManager.getPackageInfo(packageName, 0)
                Log.d("WebViewApp", "WhatsApp found: $packageName (${packageInfo.versionName})")
                return true
            } catch (e: Exception) {
                Log.d("WebViewApp", "WhatsApp package not found: $packageName")
            }
        }
        
        // Also check if any app can handle WhatsApp intents
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("whatsapp://chat/?code=test"))
            val resolveInfo = packageManager.resolveActivity(intent, 0)
            if (resolveInfo != null) {
                Log.d("WebViewApp", "WhatsApp intent can be handled by: ${resolveInfo.activityInfo.packageName}")
                return true
            }
        } catch (e: Exception) {
            Log.d("WebViewApp", "Error checking WhatsApp intent: ${e.message}")
        }
        
        Log.d("WebViewApp", "No WhatsApp app found on device")
        
        // Debug: List all apps that can handle WhatsApp URLs
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("whatsapp://"))
            val activities = packageManager.queryIntentActivities(intent, 0)
            Log.d("WebViewApp", "Apps that can handle whatsapp:// URLs:")
            for (resolveInfo in activities) {
                Log.d("WebViewApp", "  - ${resolveInfo.activityInfo.packageName}")
            }
        } catch (e: Exception) {
            Log.d("WebViewApp", "Error listing WhatsApp handlers: ${e.message}")
        }
        
        return false
    }
    
    // Try to open WhatsApp using package name directly
    private fun openWhatsAppDirectly(inviteCode: String): Boolean {
        val whatsappPackages = listOf(
            "com.whatsapp",
            "com.whatsapp.w4b",
            "com.whatsapp.business"
        )
        
        for (packageName in whatsappPackages) {
            try {
                Log.d("WebViewApp", "Trying to open WhatsApp directly with package: $packageName")
                
                // Try to launch WhatsApp main activity
                val intent = packageManager.getLaunchIntentForPackage(packageName)
                if (intent != null) {
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    
                    // Add the invite code as data
                    intent.data = Uri.parse("whatsapp://chat/?code=$inviteCode")
                    
                    startActivity(intent)
                    Log.d("WebViewApp", "Successfully opened WhatsApp with package: $packageName")
                    return true
                }
            } catch (e: Exception) {
                Log.d("WebViewApp", "Failed to open WhatsApp with package $packageName: ${e.message}")
                continue
            }
        }
        
        return false
    }
    
    // Inject JavaScript to intercept WhatsApp links
    private fun injectWhatsAppInterceptor() {
        val js = """
            (function() {
                // Intercept all WhatsApp links
                function interceptWhatsAppLinks() {
                    var links = document.querySelectorAll('a[href*="whatsapp.com"], a[href*="whatsapp://"]');
                    links.forEach(function(link) {
                        link.addEventListener('click', function(e) {
                            e.preventDefault();
                            var url = this.href;
                            console.log('WhatsApp link clicked: ' + url);
                            if (typeof Android !== 'undefined') {
                                Android.openWhatsApp(url);
                            } else {
                                // Fallback to normal navigation
                                window.location.href = url;
                            }
                        });
                    });
                }
                
                // Run immediately
                interceptWhatsAppLinks();
                
                // Also run when DOM changes (for dynamic content)
                var observer = new MutationObserver(function(mutations) {
                    interceptWhatsAppLinks();
                });
                
                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
                
                console.log('WhatsApp link interceptor installed');
            })();
        """.trimIndent()
        
        binding.webView.evaluateJavascript(js, null)
    }
    
    // Handle WhatsApp URLs directly
    private fun handleWhatsAppUrl(url: String) {
        Log.d("WebViewApp", "handleWhatsAppUrl called with: $url")
        
        try {
            // Extract invite code from various WhatsApp URL formats
            val inviteCode = when {
                url.contains("chat.whatsapp.com/") -> {
                    url.substringAfter("chat.whatsapp.com/").substringBefore("?").substringBefore("/")
                }
                url.contains("whatsapp://chat/?code=") -> {
                    url.substringAfter("whatsapp://chat/?code=")
                }
                else -> {
                    // Try to extract from any WhatsApp URL
                    url.substringAfterLast("/").substringBefore("?").substringBefore("&")
                }
            }
            
            Log.d("WebViewApp", "Extracted invite code: $inviteCode")
            
            // Try multiple WhatsApp URL formats
            val whatsappUrls = listOf(
                "whatsapp://chat/?code=$inviteCode",
                "whatsapp://send?phone=$inviteCode",
                "whatsapp://chat?code=$inviteCode"
            )
            
            var success = false
            
            for (whatsappUrl in whatsappUrls) {
                try {
                    Log.d("WebViewApp", "Trying WhatsApp URL: $whatsappUrl")
                    
                    // Create intent with proper flags
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(whatsappUrl))
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    intent.addFlags(Intent.FLAG_ACTIVITY_NO_HISTORY)
                    
                    // Try to start the activity
                    startActivity(intent)
                    Log.d("WebViewApp", "WhatsApp opened successfully with URL: $whatsappUrl")
                    success = true
                    break
                } catch (e: Exception) {
                    Log.d("WebViewApp", "Failed to open WhatsApp with URL $whatsappUrl: ${e.message}")
                    continue
                }
            }
            
            if (!success) {
                Log.d("WebViewApp", "All WhatsApp URLs failed, trying direct package approach")
                
                // Try opening WhatsApp directly using package name
                if (openWhatsAppDirectly(inviteCode)) {
                    Log.d("WebViewApp", "WhatsApp opened successfully via direct package approach")
                } else {
                    Log.d("WebViewApp", "Direct package approach failed, falling back to web version")
                    // Fallback to web version
                    val webUrl = if (url.startsWith("whatsapp://")) {
                        url.replace("whatsapp://", "https://web.whatsapp.com/")
                    } else {
                        url
                    }
                    binding.webView.loadUrl(webUrl)
                }
            }
            
        } catch (e: Exception) {
            Log.e("WebViewApp", "Error in handleWhatsAppUrl: ${e.message}")
            // Fallback to web version
            val webUrl = if (url.startsWith("whatsapp://")) {
                url.replace("whatsapp://", "https://web.whatsapp.com/")
            } else {
                url
            }
            binding.webView.loadUrl(webUrl)
        }
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        // Initialize permission manager
        permissionManager = PermissionManager(this)
        
        setupWebView()
        setupSwipeRefresh()
        setupNetworkMonitoring()
        
        // Debug WhatsApp installation
        Log.d("WebViewApp", "=== WhatsApp Installation Debug ===")
        isWhatsAppInstalled()
        Log.d("WebViewApp", "=== End WhatsApp Debug ===")
        
        // Handle notification clicks
        handleNotificationIntent(intent)
        
        // Initialize permissions and load the web app
        initializeApp()
    }
    
    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val webSettings = binding.webView.settings
        
        // Enable JavaScript
        webSettings.javaScriptEnabled = true
        
        // Enable DOM storage
        webSettings.domStorageEnabled = true
        webSettings.databaseEnabled = true
        
        // Enable file access
        webSettings.allowFileAccess = true
        webSettings.allowContentAccess = true
        
        // Enable mixed content (HTTP/HTTPS)
        webSettings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        
        // Enable responsive scaling
        webSettings.useWideViewPort = true
        webSettings.loadWithOverviewMode = true
        
        // Enable zoom controls
        webSettings.setSupportZoom(true)
        webSettings.builtInZoomControls = true
        webSettings.displayZoomControls = false
        
        // Enable cache
        webSettings.cacheMode = WebSettings.LOAD_DEFAULT
        
        // Set user agent to mimic a regular mobile browser (not WebView)
        val originalUserAgent = webSettings.userAgentString
        val mobileUserAgent = originalUserAgent.replace("wv", "").replace("WebView", "")
        webSettings.userAgentString = mobileUserAgent + " TrinityOnlineApp"
        
        // Set WebViewClient
        binding.webView.webViewClient = object : WebViewClient() {
            
            // Handle URL loading for Android API 24+
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                return handleUrlLoading(request?.url?.toString(), view)
            }
            
            // Handle URL loading for older Android versions
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                return handleUrlLoading(url, view)
            }
            
            // Common URL handling logic
            private fun handleUrlLoading(url: String?, view: WebView?): Boolean {
                if (url == null) return false
                
                Log.d("WebViewApp", "Handling URL: $url")
                
                // Handle WhatsApp links with direct approach (no detection needed)
                if (url.startsWith("whatsapp://") || url.contains("chat.whatsapp.com") || url.contains("whatsapp.com")) {
                    Log.d("WebViewApp", "Detected WhatsApp link: $url")
                    
                    try {
                        // Extract invite code from various WhatsApp URL formats
                        val inviteCode = when {
                            url.contains("chat.whatsapp.com/") -> {
                                url.substringAfter("chat.whatsapp.com/").substringBefore("?").substringBefore("/")
                            }
                            url.contains("whatsapp://chat/?code=") -> {
                                url.substringAfter("whatsapp://chat/?code=")
                            }
                            else -> {
                                // Try to extract from any WhatsApp URL
                                url.substringAfterLast("/").substringBefore("?").substringBefore("&")
                            }
                        }
                        
                        Log.d("WebViewApp", "Extracted invite code: $inviteCode")
                        
                        // Try multiple WhatsApp URL formats
                        val whatsappUrls = listOf(
                            "whatsapp://chat/?code=$inviteCode",
                            "whatsapp://send?phone=$inviteCode",
                            "whatsapp://chat?code=$inviteCode"
                        )
                        
                        var success = false
                        
                        for (whatsappUrl in whatsappUrls) {
                            try {
                                Log.d("WebViewApp", "Trying WhatsApp URL: $whatsappUrl")
                                
                                // Create intent with proper flags
                                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(whatsappUrl))
                                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                                intent.addFlags(Intent.FLAG_ACTIVITY_NO_HISTORY)
                                
                                // Try to start the activity
                                startActivity(intent)
                                Log.d("WebViewApp", "WhatsApp opened successfully with URL: $whatsappUrl")
                                success = true
                                break
                            } catch (e: Exception) {
                                Log.d("WebViewApp", "Failed to open WhatsApp with URL $whatsappUrl: ${e.message}")
                                continue
                            }
                        }
                        
                        if (!success) {
                            Log.d("WebViewApp", "All WhatsApp URLs failed, trying direct package approach")
                            
                            // Try opening WhatsApp directly using package name
                            if (openWhatsAppDirectly(inviteCode)) {
                                Log.d("WebViewApp", "WhatsApp opened successfully via direct package approach")
                            } else {
                                Log.d("WebViewApp", "Direct package approach failed, falling back to web version")
                                // Fallback to web version
                                val webUrl = if (url.startsWith("whatsapp://")) {
                                    url.replace("whatsapp://", "https://web.whatsapp.com/")
                                } else {
                                    url
                                }
                                view?.loadUrl(webUrl)
                            }
                        }
                        
                        return true
                        
                    } catch (e: Exception) {
                        Log.e("WebViewApp", "Error handling WhatsApp URL: ${e.message}")
                        // Fallback to web version
                        val webUrl = if (url.startsWith("whatsapp://")) {
                            url.replace("whatsapp://", "https://web.whatsapp.com/")
                        } else {
                            url
                        }
                        view?.loadUrl(webUrl)
                        return true
                    }
                }
                
                // Handle other external links (tel:, mailto:, etc.)
                if (url.startsWith("tel:") || url.startsWith("mailto:") || 
                    url.startsWith("sms:") || url.startsWith("geo:")) {
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                        startActivity(intent)
                        return true
                    } catch (e: Exception) {
                        // If no app can handle the intent, continue with WebView
                    }
                }
                
                // Handle all other URLs in the same WebView
                view?.loadUrl(url)
                return true
            }
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                binding.progressBar.visibility = View.VISIBLE
                binding.swipeRefresh.isRefreshing = false
                
                // Hide refresh button when page starts loading
                hideRefreshButton()
            }
            
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                binding.progressBar.visibility = View.GONE
                binding.swipeRefresh.isRefreshing = false
                
                // Hide no internet screen if it was showing
                binding.noInternetLayout.visibility = View.GONE
                binding.webView.visibility = View.VISIBLE
                
                // Hide refresh button when page loads
                hideRefreshButton()
                
                // Inject JavaScript to intercept WhatsApp links
                injectWhatsAppInterceptor()
            }
            
            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                
                if (request?.isForMainFrame == true) {
                    when (error?.errorCode) {
                        ERROR_HOST_LOOKUP,
                        ERROR_CONNECT,
                        ERROR_TIMEOUT -> {
                            showNoInternetScreen()
                        }
                        else -> {
                            // Show custom error for other errors
                            showCustomErrorScreen()
                        }
                    }
                }
            }
            

        }
        
        // Set WebChromeClient for file uploads
        binding.webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView?,
                callback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                // Cancel any previous file chooser
                if (filePathCallback != null) {
                    filePathCallback?.onReceiveValue(null)
                    filePathCallback = null
                }
                
                filePathCallback = callback
                
                // Check if camera is available
                val hasCamera = packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)
                
                if (hasCamera) {
                    // Show options dialog for camera or gallery
                    showFileChooserDialog()
                } else {
                    // No camera available, only show gallery
                    galleryLauncher.launch("*/*")
                }
                
                return true
            }
            
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                super.onProgressChanged(view, newProgress)
                binding.progressBar.progress = newProgress
            }
        }
        
        // Inject JavaScript interfaces
        binding.webView.addJavascriptInterface(object {
            @JavascriptInterface
            fun openWhatsApp(url: String) {
                runOnUiThread {
                    handleWhatsAppUrl(url)
                }
            }
            
            @JavascriptInterface
            fun showNotification(title: String, message: String, url: String = "") {
                runOnUiThread {
                    showLocalNotification(title, message, url)
                }
            }
            
            @JavascriptInterface
            fun isAndroidApp(): Boolean {
                return true
            }
        }, "Android")
    }
    
    private fun setupSwipeRefresh() {
        // Disable automatic refresh - we'll handle it manually
        binding.swipeRefresh.isEnabled = false
        
        // Create a custom refresh button that appears when needed
        val refreshButton = Button(this).apply {
            text = "🔄 Refresh"
            setTextColor(android.graphics.Color.WHITE)
            setBackgroundColor(android.graphics.Color.parseColor("#1976D2"))
            setPadding(32, 16, 32, 16)
            elevation = 8f
            alpha = 0f // Start invisible
            isClickable = false // Start non-clickable
            isEnabled = false // Start disabled
            isFocusable = false // Start non-focusable
            
            setOnClickListener {
                if (NetworkUtils.isNetworkAvailable(this@MainActivity)) {
                    binding.webView.reload()
                    hideRefreshButton()
                } else {
                    showNoInternetScreen()
                    Toast.makeText(this@MainActivity, "No internet connection", Toast.LENGTH_SHORT).show()
                }
            }
        }
        
        // Add the refresh button to the layout
        binding.root.addView(refreshButton)
        
        // Store reference to the refresh button
        this.refreshButton = refreshButton
        
        // Set up scroll detection to show/hide refresh button
        binding.webView.setOnScrollChangeListener { _, _, scrollY, _, oldScrollY ->
            // Only show refresh button when at the top (scrollY <= 0) and user is pulling down
            if (scrollY <= 0 && scrollY < oldScrollY) {
                showRefreshButton()
            } else {
                hideRefreshButton()
            }
        }
        
        // Also detect pull-to-refresh gesture manually
        var startY = 0f
        var isPullingDown = false
        
        binding.webView.setOnTouchListener { _, event ->
            when (event.action) {
                android.view.MotionEvent.ACTION_DOWN -> {
                    startY = event.y
                    isPullingDown = false
                }
                android.view.MotionEvent.ACTION_MOVE -> {
                    val deltaY = event.y - startY
                    // Check if user is pulling down and at the top of the page
                    if (deltaY > 50 && binding.webView.scrollY <= 0) {
                        if (!isPullingDown) {
                            isPullingDown = true
                            showRefreshButton()
                        }
                    } else {
                        isPullingDown = false
                        hideRefreshButton()
                    }
                }
                android.view.MotionEvent.ACTION_UP -> {
                    isPullingDown = false
                    // Don't hide immediately, let user see the button
                }
            }
            
            // Hide refresh button when user interacts with the page (any touch)
            if (refreshButton?.alpha == 1f) {
                hideRefreshButton()
            }
            
            false // Don't consume the touch event
        }
    }
    
    private var refreshButton: Button? = null
    private var hideButtonHandler: android.os.Handler? = null
    private var hideButtonRunnable: Runnable? = null
    
    private fun showRefreshButton() {
        refreshButton?.let { button ->
            button.isClickable = true
            button.isEnabled = true
            button.isFocusable = true
            button.animate()
                .alpha(1f)
                .translationY(100f)
                .setDuration(200)
                .start()
            
            // Start auto-hide timer (6 seconds)
            startAutoHideTimer()
        }
    }
    
    private fun hideRefreshButton() {
        refreshButton?.let { button ->
            button.isClickable = false
            button.isEnabled = false
            button.isFocusable = false
            button.animate()
                .alpha(0f)
                .translationY(0f)
                .setDuration(200)
                .start()
        }
        
        // Cancel auto-hide timer
        cancelAutoHideTimer()
    }
    
    private fun startAutoHideTimer() {
        // Cancel any existing timer
        cancelAutoHideTimer()
        
        // Create new handler and runnable
        hideButtonHandler = android.os.Handler(android.os.Looper.getMainLooper())
        hideButtonRunnable = Runnable {
            hideRefreshButton()
        }
        
        // Start 6-second timer
        hideButtonHandler?.postDelayed(hideButtonRunnable!!, 6000)
    }
    
    private fun cancelAutoHideTimer() {
        hideButtonRunnable?.let { runnable ->
            hideButtonHandler?.removeCallbacks(runnable)
        }
        hideButtonHandler = null
        hideButtonRunnable = null
    }
    
    // Camera and file upload helper methods
    private fun showFileChooserDialog() {
        val options = arrayOf("Camera", "Gallery")
        androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle("Choose File Source")
            .setItems(options) { _, which ->
                when (which) {
                    0 -> checkCameraPermissionAndOpen()
                    1 -> galleryLauncher.launch("*/*")
                }
            }
            .setNegativeButton("Cancel") { _, _ ->
                filePathCallback?.onReceiveValue(null)
                filePathCallback = null
            }
            .show()
    }
    
    private fun checkCameraPermissionAndOpen() {
        if (PermissionManager.isPermissionGranted(this, PermissionManager.PERMISSION_CAMERA)) {
            // Permission already granted
            openCamera()
        } else {
            // Request camera permission only when needed
            permissionManager.requestCameraPermissionOnly(
                onGranted = {
                    openCamera()
                },
                onDenied = {
                    Toast.makeText(this, "Camera access is required to take photos.", Toast.LENGTH_LONG).show()
                    filePathCallback?.onReceiveValue(null)
                    filePathCallback = null
                }
            )
        }
    }
    

    
    private fun openCamera() {
        try {
            // Create file for the photo
            val photoFile = createImageFile()
            photoUri = FileProvider.getUriForFile(
                this,
                "${applicationContext.packageName}.fileprovider",
                photoFile
            )
            
            // Launch camera
            cameraLauncher.launch(photoUri)
        } catch (e: IOException) {
            Log.e("WebViewApp", "Error creating image file: ${e.message}")
            Toast.makeText(this, "Error accessing camera", Toast.LENGTH_SHORT).show()
            filePathCallback?.onReceiveValue(null)
            filePathCallback = null
        }
    }
    
    @Throws(IOException::class)
    private fun createImageFile(): File {
        // Create an image file name
        val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val imageFileName = "JPEG_${timeStamp}_"
        val storageDir = getExternalFilesDir(null)
        
        return File.createTempFile(
            imageFileName, /* prefix */
            ".jpg", /* suffix */
            storageDir /* directory */
        ).apply {
            currentPhotoPath = absolutePath
        }
    }
    
    private fun setupNetworkMonitoring() {
        // Monitor network changes
        NetworkUtils.registerNetworkCallback(this) { isConnected ->
            runOnUiThread {
                try {
                    if (!isFinishing && !isDestroyed && ::binding.isInitialized) {
                        if (isConnected) {
                            // Network is back, reload if showing error screen
                            if (binding.noInternetLayout.visibility == View.VISIBLE) {
                                binding.webView.loadUrl(WEB_APP_URL)
                            }
                        } else {
                            // Network lost, show error screen
                            showNoInternetScreen()
                        }
                    }
                } catch (e: Exception) {
                    Log.e("WebViewApp", "Error in network callback: ${e.message}")
                }
            }
        }
    }
    

    
    private fun initializeApp() {
        // Only request notifications permission on first launch
        if (!PermissionManager.isPermissionGranted(this, PermissionManager.PERMISSION_NOTIFICATIONS)) {
            permissionManager.requestNotificationPermissionOnly(
                onGranted = {
                    Toast.makeText(this, "Notifications enabled! You'll receive important updates.", Toast.LENGTH_SHORT).show()
                },
                onDenied = {
                    Toast.makeText(this, "Notifications disabled. You may miss important updates.", Toast.LENGTH_LONG).show()
                }
            )
        }
        
        // Load the web app immediately
        if (NetworkUtils.isNetworkAvailable(this)) {
            binding.webView.loadUrl(WEB_APP_URL)
        } else {
            showNoInternetScreen()
        }
    }
    
    private fun showLocalNotification(title: String, message: String, url: String = "") {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        
        // Create notification channel for Android O and above
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "trinity_local_notifications",
                "Trinity Local Notifications",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Local notifications triggered from web app"
                enableLights(true)
                enableVibration(true)
                setShowBadge(true)
            }
            notificationManager.createNotificationChannel(channel)
        }
        
        // Create intent for notification click
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            if (url.isNotEmpty()) {
                data = Uri.parse(url)
            }
        }
        
        val pendingIntent = PendingIntent.getActivity(
            this,
            System.currentTimeMillis().toInt(),
            intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )
        
        // Build and show notification
        val notification = NotificationCompat.Builder(this, "trinity_local_notifications")
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(message)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setVibrate(longArrayOf(500, 500, 500))
            .build()
        
        notificationManager.notify(System.currentTimeMillis().toInt(), notification)
        
        Log.d("TrinityApp", "📱 Local notification shown: $title - $message")
    }
    
    private fun showNoInternetScreen() {
        try {
            if (!isFinishing && !isDestroyed && ::binding.isInitialized) {
                binding.webView.visibility = View.GONE
                binding.noInternetLayout.visibility = View.VISIBLE
                
                binding.retryButton.setOnClickListener {
                    try {
                        if (!isFinishing && !isDestroyed && ::binding.isInitialized) {
                            if (NetworkUtils.isNetworkAvailable(this)) {
                                binding.webView.loadUrl(WEB_APP_URL)
                            } else {
                                Toast.makeText(this, "Still no internet connection", Toast.LENGTH_SHORT).show()
                            }
                        }
                    } catch (e: Exception) {
                        Log.e("WebViewApp", "Error in retry button click: ${e.message}")
                        Toast.makeText(this, "Error occurred. Please try again.", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        } catch (e: Exception) {
            Log.e("WebViewApp", "Error showing no internet screen: ${e.message}")
        }
    }
    
    private fun showCustomErrorScreen() {
        try {
            if (!isFinishing && !isDestroyed && ::binding.isInitialized) {
                binding.webView.visibility = View.GONE
                binding.noInternetLayout.visibility = View.VISIBLE
                binding.errorMessage.text = "We can't access the database right now, please check your connection and try again."
                
                binding.retryButton.setOnClickListener {
                    try {
                        if (!isFinishing && !isDestroyed && ::binding.isInitialized) {
                            binding.webView.reload()
                        }
                    } catch (e: Exception) {
                        Log.e("WebViewApp", "Error in custom error retry: ${e.message}")
                        Toast.makeText(this, "Error occurred. Please try again.", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        } catch (e: Exception) {
            Log.e("WebViewApp", "Error showing custom error screen: ${e.message}")
        }
    }
    
    private fun handleNotificationIntent(intent: Intent?) {
        val data = intent?.data
        if (data != null) {
            // Navigate to specific URL from notification
            binding.webView.loadUrl(data.toString())
        }
    }
    
    override fun onBackPressed() {
        if (binding.webView.canGoBack()) {
            binding.webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
    
    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        handleNotificationIntent(intent)
    }
    
    override fun onResume() {
        super.onResume()
        try {
            // Resume WebView if it was paused
            binding.webView.onResume()
        } catch (e: Exception) {
            Log.e("WebViewApp", "Error in onResume: ${e.message}")
        }
    }
    
    override fun onPause() {
        super.onPause()
        try {
            // Pause WebView but keep it running in background
            binding.webView.onPause()
        } catch (e: Exception) {
            Log.e("WebViewApp", "Error in onPause: ${e.message}")
        }
    }
    
    override fun onDestroy() {
        super.onDestroy()
        try {
            // Clean up network monitoring
            NetworkUtils.unregisterNetworkCallback(this)
            
            // Clean up refresh button timer
            cancelAutoHideTimer()
        } catch (e: Exception) {
            Log.e("WebViewApp", "Error in onDestroy: ${e.message}")
        }
    }
}
