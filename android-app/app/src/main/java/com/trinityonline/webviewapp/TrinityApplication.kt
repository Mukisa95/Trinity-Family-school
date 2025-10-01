package com.trinityonline.webviewapp

import android.app.Application
import com.google.firebase.FirebaseApp

class TrinityApplication : Application() {
    
    override fun onCreate() {
        super.onCreate()
        
        // Initialize Firebase
        FirebaseApp.initializeApp(this)
    }
}
