package com.trinityonline.webviewapp.utils

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Build

object NetworkUtils {
    
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var connectivityManager: ConnectivityManager? = null
    
    fun isNetworkAvailable(context: Context): Boolean {
        return try {
            val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val network = cm.activeNetwork ?: return false
                val activeNetwork = cm.getNetworkCapabilities(network) ?: return false
                
                activeNetwork.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                        activeNetwork.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
            } else {
                @Suppress("DEPRECATION")
                val networkInfo = cm.activeNetworkInfo
                @Suppress("DEPRECATION")
                networkInfo?.isConnected == true
            }
        } catch (e: Exception) {
            android.util.Log.e("NetworkUtils", "Error checking network availability: ${e.message}")
            false
        }
    }
    
    fun registerNetworkCallback(context: Context, callback: (Boolean) -> Unit) {
        try {
            connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            
            networkCallback = object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    super.onAvailable(network)
                    try {
                        callback(true)
                    } catch (e: Exception) {
                        android.util.Log.e("NetworkUtils", "Error in onAvailable callback: ${e.message}")
                    }
                }
                
                override fun onLost(network: Network) {
                    super.onLost(network)
                    try {
                        callback(false)
                    } catch (e: Exception) {
                        android.util.Log.e("NetworkUtils", "Error in onLost callback: ${e.message}")
                    }
                }
                
                override fun onCapabilitiesChanged(
                    network: Network,
                    networkCapabilities: NetworkCapabilities
                ) {
                    super.onCapabilitiesChanged(network, networkCapabilities)
                    try {
                        val hasInternet = networkCapabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                                networkCapabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
                        callback(hasInternet)
                    } catch (e: Exception) {
                        android.util.Log.e("NetworkUtils", "Error in onCapabilitiesChanged callback: ${e.message}")
                    }
                }
            }
            
            val networkRequest = NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build()
            
            connectivityManager?.registerNetworkCallback(networkRequest, networkCallback!!)
        } catch (e: Exception) {
            android.util.Log.e("NetworkUtils", "Error registering network callback: ${e.message}")
        }
    }
    
    fun unregisterNetworkCallback(context: Context) {
        try {
            networkCallback?.let { callback ->
                connectivityManager?.unregisterNetworkCallback(callback)
                networkCallback = null
            }
        } catch (e: Exception) {
            android.util.Log.e("NetworkUtils", "Error unregistering network callback: ${e.message}")
        }
    }
}
