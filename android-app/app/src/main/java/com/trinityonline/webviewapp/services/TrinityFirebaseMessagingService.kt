package com.trinityonline.webviewapp.services

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.trinityonline.webviewapp.MainActivity
import com.trinityonline.webviewapp.R

class TrinityFirebaseMessagingService : FirebaseMessagingService() {
    
    companion object {
        private const val CHANNEL_ID = "trinity_online_channel"
        private const val CHANNEL_NAME = "Trinity Online Notifications"
        private const val CHANNEL_DESCRIPTION = "Notifications from Trinity Online"
    }
    
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // Send token to your web app server
        sendRegistrationToServer(token)
    }
    
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        
        // Create notification channel for Android O and above
        createNotificationChannel()
        
        // Handle notification data
        val title = remoteMessage.notification?.title ?: "Trinity Online"
        val message = remoteMessage.notification?.body ?: "New notification"
        val clickAction = remoteMessage.data["click_action"] ?: ""
        val url = remoteMessage.data["url"] ?: ""
        
        // Show notification
        showNotification(title, message, clickAction, url)
    }
    
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = CHANNEL_DESCRIPTION
                enableLights(true)
                enableVibration(true)
                setShowBadge(true)
            }
            
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }
    
    private fun showNotification(title: String, message: String, clickAction: String, url: String) {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            if (url.isNotEmpty()) {
                data = Uri.parse(url)
            }
            if (clickAction.isNotEmpty()) {
                action = clickAction
            }
        }
        
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )
        
        val defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        
        val notificationBuilder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(message)
            .setAutoCancel(true)
            .setSound(defaultSoundUri)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setVibrate(longArrayOf(1000, 1000, 1000, 1000, 1000))
        
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(System.currentTimeMillis().toInt(), notificationBuilder.build())
    }
    
    private fun sendRegistrationToServer(token: String) {
        // Send FCM token to web app server
        Thread {
            try {
                val url = java.net.URL("https://trinityfamilyschool.vercel.app/api/notifications/register-fcm")
                val client = url.openConnection() as java.net.HttpURLConnection
                client.apply {
                    requestMethod = "POST"
                    setRequestProperty("Content-Type", "application/json")
                    doOutput = true
                }
                
                val jsonPayload = """
                {
                    "token": "$token",
                    "platform": "android",
                    "appVersion": "${android.os.Build.VERSION.RELEASE}",
                    "userId": null
                }
                """.trimIndent()
                
                client.outputStream.use { os ->
                    os.write(jsonPayload.toByteArray())
                }
                
                val responseCode = client.responseCode
                if (responseCode == 200) {
                    android.util.Log.d("FCM", "✅ Token registered successfully")
                } else {
                    android.util.Log.e("FCM", "❌ Token registration failed: $responseCode")
                }
                
            } catch (e: Exception) {
                android.util.Log.e("FCM", "❌ Token registration error: ${e.message}")
            }
        }.start()
    }
}
