package com.trinityonline.webviewapp

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity

class PermissionManager(private val activity: FragmentActivity) {
    
    companion object {
        private const val TAG = "PermissionManager"
        
        // Permission constants
        const val PERMISSION_NOTIFICATIONS = "notifications"
        const val PERMISSION_CAMERA = "camera"
        
        // Check if permission is granted
        fun isPermissionGranted(context: Context, permission: String): Boolean {
            return when (permission) {
                PERMISSION_NOTIFICATIONS -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
                    } else {
                        true // Pre-Android 13, notifications are granted by default
                    }
                }
                PERMISSION_CAMERA -> {
                    ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
                }
                else -> false
            }
        }
    }
    
    // Permission request launchers
    private val notificationPermissionLauncher = activity.registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        handlePermissionResult(PERMISSION_NOTIFICATIONS, isGranted)
    }
    
    private val cameraPermissionLauncher = activity.registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        handlePermissionResult(PERMISSION_CAMERA, isGranted)
    }
    
    // Settings launcher
    private val settingsLauncher = activity.registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        // Check permissions again after returning from settings
        checkAndRequestPermissions()
    }
    
    // Permission request callbacks
    private var onPermissionGranted: ((String) -> Unit)? = null
    private var onPermissionDenied: ((String) -> Unit)? = null
    private var onAllPermissionsGranted: (() -> Unit)? = null
    
    // Track permission states
    private val permissionStates = mutableMapOf<String, Boolean>()
    
    /**
     * Request notification permission only
     */
    fun requestNotificationPermissionOnly(
        onGranted: (() -> Unit)? = null,
        onDenied: (() -> Unit)? = null
    ) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            // Pre-Android 13, notifications are granted by default
            onGranted?.invoke()
            return
        }
        
        if (ActivityCompat.shouldShowRequestPermissionRationale(activity, Manifest.permission.POST_NOTIFICATIONS)) {
            // Show explanation dialog
            showPermissionExplanationDialog(
                "Notification Permission",
                "Trinity Online needs notification permission to:\n\n" +
                "• Receive important school updates and announcements\n" +
                "• Get notified about new messages and events\n" +
                "• Stay informed about your child's progress\n\n" +
                "This helps you stay connected with the school community.",
                "Grant Permission",
                "Not Now"
            ) { granted ->
                if (granted) {
                    notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                    // Set temporary callbacks
                    val tempOnGranted = onGranted
                    val tempOnDenied = onDenied
                    onPermissionGranted = { permission ->
                        if (permission == PERMISSION_NOTIFICATIONS) {
                            tempOnGranted?.invoke()
                        }
                    }
                    onPermissionDenied = { permission ->
                        if (permission == PERMISSION_NOTIFICATIONS) {
                            tempOnDenied?.invoke()
                        }
                    }
                } else {
                    onDenied?.invoke()
                }
            }
        } else {
            // Request permission directly
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            // Set temporary callbacks
            val tempOnGranted = onGranted
            val tempOnDenied = onDenied
            onPermissionGranted = { permission ->
                if (permission == PERMISSION_NOTIFICATIONS) {
                    tempOnGranted?.invoke()
                }
            }
            onPermissionDenied = { permission ->
                if (permission == PERMISSION_NOTIFICATIONS) {
                    tempOnDenied?.invoke()
                }
            }
        }
    }
    
    /**
     * Request camera permission only
     */
    fun requestCameraPermissionOnly(
        onGranted: (() -> Unit)? = null,
        onDenied: (() -> Unit)? = null
    ) {
        if (ActivityCompat.shouldShowRequestPermissionRationale(activity, Manifest.permission.CAMERA)) {
            // Show explanation dialog
            showPermissionExplanationDialog(
                "Camera Permission",
                "Trinity Online needs camera permission to:\n\n" +
                "• Take photos for profile pictures\n" +
                "• Upload documents and assignments\n" +
                "• Capture images for school projects\n" +
                "• Scan QR codes or documents\n\n" +
                "This enhances your experience with file uploads and photo features.",
                "Grant Permission",
                "Not Now"
            ) { granted ->
                if (granted) {
                    cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                    // Set temporary callbacks
                    val tempOnGranted = onGranted
                    val tempOnDenied = onDenied
                    onPermissionGranted = { permission ->
                        if (permission == PERMISSION_CAMERA) {
                            tempOnGranted?.invoke()
                        }
                    }
                    onPermissionDenied = { permission ->
                        if (permission == PERMISSION_CAMERA) {
                            tempOnDenied?.invoke()
                        }
                    }
                } else {
                    onDenied?.invoke()
                }
            }
        } else {
            // Request permission directly
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
            // Set temporary callbacks
            val tempOnGranted = onGranted
            val tempOnDenied = onDenied
            onPermissionGranted = { permission ->
                if (permission == PERMISSION_CAMERA) {
                    tempOnGranted?.invoke()
                }
            }
            onPermissionDenied = { permission ->
                if (permission == PERMISSION_CAMERA) {
                    tempOnDenied?.invoke()
                }
            }
        }
    }
    
    /**
     * Check and request all required permissions
     */
    fun checkAndRequestPermissions() {
        updatePermissionStates()
        
        val permissionsToRequest = mutableListOf<String>()
        
        // Check notifications permission
        if (!isPermissionGranted(activity, PERMISSION_NOTIFICATIONS)) {
            permissionsToRequest.add(PERMISSION_NOTIFICATIONS)
        }
        
        // Check camera permission
        if (!isPermissionGranted(activity, PERMISSION_CAMERA)) {
            permissionsToRequest.add(PERMISSION_CAMERA)
        }
        
        if (permissionsToRequest.isEmpty()) {
            // All permissions are granted
            onAllPermissionsGranted?.invoke()
            return
        }
        
        // Request permissions one by one with explanations
        requestNextPermission(permissionsToRequest)
    }
    
    /**
     * Request permissions one by one with explanations
     */
    private fun requestNextPermission(permissions: List<String>) {
        if (permissions.isEmpty()) {
            // All permissions processed
            onAllPermissionsGranted?.invoke()
            return
        }
        
        val permission = permissions[0]
        val remainingPermissions = permissions.drop(1)
        
        when (permission) {
            PERMISSION_NOTIFICATIONS -> requestNotificationPermission(remainingPermissions)
            PERMISSION_CAMERA -> requestCameraPermission(remainingPermissions)
        }
    }
    
    /**
     * Request notification permission with explanation
     */
    private fun requestNotificationPermission(remainingPermissions: List<String>) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            // Pre-Android 13, notifications are granted by default
            permissionStates[PERMISSION_NOTIFICATIONS] = true
            onPermissionGranted?.invoke(PERMISSION_NOTIFICATIONS)
            requestNextPermission(remainingPermissions)
            return
        }
        
        if (ActivityCompat.shouldShowRequestPermissionRationale(activity, Manifest.permission.POST_NOTIFICATIONS)) {
            // Show explanation dialog
            showPermissionExplanationDialog(
                "Notification Permission",
                "Trinity Online needs notification permission to:\n\n" +
                "• Receive important school updates and announcements\n" +
                "• Get notified about new messages and events\n" +
                "• Stay informed about your child's progress\n\n" +
                "This helps you stay connected with the school community.",
                "Grant Permission",
                "Not Now"
            ) { granted ->
                if (granted) {
                    notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                } else {
                    permissionStates[PERMISSION_NOTIFICATIONS] = false
                    onPermissionDenied?.invoke(PERMISSION_NOTIFICATIONS)
                    requestNextPermission(remainingPermissions)
                }
            }
        } else {
            // Request permission directly
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }
    
    /**
     * Request camera permission with explanation
     */
    private fun requestCameraPermission(remainingPermissions: List<String>) {
        if (ActivityCompat.shouldShowRequestPermissionRationale(activity, Manifest.permission.CAMERA)) {
            // Show explanation dialog
            showPermissionExplanationDialog(
                "Camera Permission",
                "Trinity Online needs camera permission to:\n\n" +
                "• Take photos for profile pictures\n" +
                "• Upload documents and assignments\n" +
                "• Capture images for school projects\n" +
                "• Scan QR codes or documents\n\n" +
                "This enhances your experience with file uploads and photo features.",
                "Grant Permission",
                "Not Now"
            ) { granted ->
                if (granted) {
                    cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                } else {
                    permissionStates[PERMISSION_CAMERA] = false
                    onPermissionDenied?.invoke(PERMISSION_CAMERA)
                    requestNextPermission(remainingPermissions)
                }
            }
        } else {
            // Request permission directly
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }
    
    /**
     * Handle permission request results
     */
    private fun handlePermissionResult(permission: String, isGranted: Boolean) {
        permissionStates[permission] = isGranted
        
        if (isGranted) {
            Log.d(TAG, "Permission granted: $permission")
            onPermissionGranted?.invoke(permission)
        } else {
            Log.d(TAG, "Permission denied: $permission")
            onPermissionDenied?.invoke(permission)
            
            // Show settings dialog if permission is permanently denied
            if (!ActivityCompat.shouldShowRequestPermissionRationale(activity, getPermissionString(permission))) {
                showSettingsDialog(permission)
            }
        }
        
        // Check if all permissions are now granted
        updatePermissionStates()
        if (permissionStates.values.all { it }) {
            onAllPermissionsGranted?.invoke()
        }
    }
    
    /**
     * Show permission explanation dialog
     */
    private fun showPermissionExplanationDialog(
        title: String,
        message: String,
        positiveButton: String,
        negativeButton: String,
        onResult: (Boolean) -> Unit
    ) {
        AlertDialog.Builder(activity)
            .setTitle(title)
            .setMessage(message)
            .setPositiveButton(positiveButton) { _, _ -> onResult(true) }
            .setNegativeButton(negativeButton) { _, _ -> onResult(false) }
            .setCancelable(false)
            .show()
    }
    
    /**
     * Show settings dialog for permanently denied permissions
     */
    private fun showSettingsDialog(permission: String) {
        val permissionName = when (permission) {
            PERMISSION_NOTIFICATIONS -> "Notifications"
            PERMISSION_CAMERA -> "Camera"
            else -> "This permission"
        }
        
        AlertDialog.Builder(activity)
            .setTitle("Permission Required")
            .setMessage("$permissionName permission is required for the best experience. " +
                    "You can enable it in Settings.")
            .setPositiveButton("Open Settings") { _, _ ->
                openAppSettings()
            }
            .setNegativeButton("Not Now") { _, _ ->
                // User chose not to open settings
            }
            .setCancelable(false)
            .show()
    }
    
    /**
     * Open app settings page
     */
    private fun openAppSettings() {
        try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.fromParts("package", activity.packageName, null)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            settingsLauncher.launch(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Error opening settings: ${e.message}")
            // Fallback to general settings
            try {
                val intent = Intent(Settings.ACTION_SETTINGS)
                settingsLauncher.launch(intent)
            } catch (e2: Exception) {
                Log.e(TAG, "Error opening general settings: ${e2.message}")
            }
        }
    }
    

    
    /**
     * Update permission states
     */
    private fun updatePermissionStates() {
        permissionStates[PERMISSION_NOTIFICATIONS] = isPermissionGranted(activity, PERMISSION_NOTIFICATIONS)
        permissionStates[PERMISSION_CAMERA] = isPermissionGranted(activity, PERMISSION_CAMERA)
    }
    
    /**
     * Get permission string for the given permission type
     */
    private fun getPermissionString(permission: String): String {
        return when (permission) {
            PERMISSION_NOTIFICATIONS -> Manifest.permission.POST_NOTIFICATIONS
            PERMISSION_CAMERA -> Manifest.permission.CAMERA
            else -> ""
        }
    }
    
    /**
     * Check if all permissions are granted
     */
    fun areAllPermissionsGranted(): Boolean {
        updatePermissionStates()
        return permissionStates.values.all { it }
    }
    
    /**
     * Get current permission states
     */
    fun getPermissionStates(): Map<String, Boolean> {
        updatePermissionStates()
        return permissionStates.toMap()
    }
}
