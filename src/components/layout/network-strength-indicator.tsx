"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type ConnectionStrength = 'excellent' | 'good' | 'fair' | 'poor' | 'offline';

interface NetworkInfo {
    strength: ConnectionStrength;
    latency: number;
    online: boolean;
}

/**
 * Network Strength Indicator Component
 * Shows a phone-like signal bar indicating network connection quality
 */
export function NetworkStrengthIndicator() {
    const [network, setNetwork] = useState<NetworkInfo>({
        strength: 'good',
        latency: 0,
        online: typeof navigator !== 'undefined' ? navigator.onLine : true
    });
    const [showTooltip, setShowTooltip] = useState(false);

    useEffect(() => {
        const measureLatency = async () => {
            if (!navigator.onLine) {
                setNetwork(prev => ({ ...prev, online: false, strength: 'offline' }));
                return;
            }

            try {
                const start = performance.now();
                // Ping a small endpoint to measure latency
                await fetch('https://www.gstatic.com/generate_204', {
                    mode: 'no-cors',
                    cache: 'no-store'
                });
                const latency = performance.now() - start;

                // Determine strength based on latency
                let strength: ConnectionStrength;
                if (latency < 100) {
                    strength = 'excellent';
                } else if (latency < 300) {
                    strength = 'good';
                } else if (latency < 600) {
                    strength = 'fair';
                } else {
                    strength = 'poor';
                }

                setNetwork({ strength, latency: Math.round(latency), online: true });
            } catch (error) {
                // If fetch fails, we're likely offline or have very poor connection
                setNetwork(prev => ({
                    ...prev,
                    strength: navigator.onLine ? 'poor' : 'offline',
                    online: navigator.onLine
                }));
            }
        };

        // Initial measurement
        measureLatency();

        // Measure every 10 seconds
        const interval = setInterval(measureLatency, 10000);

        // Listen for online/offline events
        const handleOnline = () => {
            setNetwork(prev => ({ ...prev, online: true }));
            measureLatency();
        };

        const handleOffline = () => {
            setNetwork({ strength: 'offline', latency: 0, online: false });
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            clearInterval(interval);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Get color based on strength
    const getColor = () => {
        switch (network.strength) {
            case 'excellent': return '#22c55e'; // green-500
            case 'good': return '#3b82f6'; // blue-500
            case 'fair': return '#f59e0b'; // amber-500
            case 'poor': return '#ef4444'; // red-500
            case 'offline': return '#6b7280'; // gray-500
        }
    };

    // Get label based on strength
    const getLabel = () => {
        switch (network.strength) {
            case 'excellent': return 'Excellent';
            case 'good': return 'Good';
            case 'fair': return 'Fair';
            case 'poor': return 'Poor';
            case 'offline': return 'Offline';
        }
    };

    // Get number of active bars (out of 4)
    const getActiveBars = () => {
        switch (network.strength) {
            case 'excellent': return 4;
            case 'good': return 3;
            case 'fair': return 2;
            case 'poor': return 1;
            case 'offline': return 0;
        }
    };

    const activeBars = getActiveBars();
    const color = getColor();

    return (
        <div
            className="relative"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            <button
                className="relative p-1.5 hover:bg-blue-50/80 rounded-full transition-all duration-200 transform hover:scale-110 active:scale-95"
                style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
                type="button"
                aria-label={`Network: ${getLabel()}`}
            >
                {/* Signal Bars SVG */}
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="transition-all duration-300"
                >
                    {/* Bar 1 - shortest */}
                    <motion.rect
                        x="3"
                        y="16"
                        width="4"
                        height="5"
                        rx="1"
                        fill={activeBars >= 1 ? color : '#e5e7eb'}
                        initial={{ opacity: 0, scaleY: 0 }}
                        animate={{ opacity: 1, scaleY: 1 }}
                        transition={{ delay: 0.1 }}
                        style={{ transformOrigin: 'bottom' }}
                    />
                    {/* Bar 2 */}
                    <motion.rect
                        x="8"
                        y="12"
                        width="4"
                        height="9"
                        rx="1"
                        fill={activeBars >= 2 ? color : '#e5e7eb'}
                        initial={{ opacity: 0, scaleY: 0 }}
                        animate={{ opacity: 1, scaleY: 1 }}
                        transition={{ delay: 0.2 }}
                        style={{ transformOrigin: 'bottom' }}
                    />
                    {/* Bar 3 */}
                    <motion.rect
                        x="13"
                        y="7"
                        width="4"
                        height="14"
                        rx="1"
                        fill={activeBars >= 3 ? color : '#e5e7eb'}
                        initial={{ opacity: 0, scaleY: 0 }}
                        animate={{ opacity: 1, scaleY: 1 }}
                        transition={{ delay: 0.3 }}
                        style={{ transformOrigin: 'bottom' }}
                    />
                    {/* Bar 4 - tallest */}
                    <motion.rect
                        x="18"
                        y="3"
                        width="4"
                        height="18"
                        rx="1"
                        fill={activeBars >= 4 ? color : '#e5e7eb'}
                        initial={{ opacity: 0, scaleY: 0 }}
                        animate={{ opacity: 1, scaleY: 1 }}
                        transition={{ delay: 0.4 }}
                        style={{ transformOrigin: 'bottom' }}
                    />

                    {/* Offline X overlay */}
                    {network.strength === 'offline' && (
                        <motion.g
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.5 }}
                        >
                            <line x1="5" y1="5" x2="19" y2="19" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
                            <line x1="19" y1="5" x2="5" y2="19" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
                        </motion.g>
                    )}
                </svg>

                {/* Pulsing indicator for active connection */}
                {network.online && network.strength !== 'poor' && (
                    <motion.div
                        className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                        style={{ backgroundColor: color }}
                        animate={{
                            scale: [1, 1.2, 1],
                            opacity: [1, 0.7, 1]
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    />
                )}
            </button>

            {/* Tooltip */}
            <AnimatePresence>
                {showTooltip && (
                    <motion.div
                        initial={{ opacity: 0, y: 5, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 px-3 py-2 bg-gray-900/95 backdrop-blur-sm text-white text-xs rounded-lg shadow-lg z-50 whitespace-nowrap"
                    >
                        <div className="flex items-center gap-2">
                            <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: color }}
                            />
                            <span className="font-medium">{getLabel()}</span>
                        </div>
                        {network.online && network.latency > 0 && (
                            <div className="text-gray-400 mt-1">
                                Latency: {network.latency}ms
                            </div>
                        )}
                        {!network.online && (
                            <div className="text-red-400 mt-1">
                                No internet connection
                            </div>
                        )}
                        {/* Tooltip arrow */}
                        <div className="absolute -top-1 right-4 w-2 h-2 bg-gray-900/95 rotate-45" />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
