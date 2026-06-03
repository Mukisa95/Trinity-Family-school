"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { School } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SchoolSettingsLoader() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center space-y-2 w-full"
    >
      {/* Logo placeholder with shimmer */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4, type: "spring", stiffness: 200 }}
        className="relative w-16 h-16 mb-2 rounded-md overflow-hidden"
      >
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 dark:from-blue-400/30 dark:via-purple-400/30 dark:to-pink-400/30" />
        
        {/* Shimmer effect */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
          animate={{
            x: ['-100%', '200%'],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "linear",
          }}
        />
        
        {/* Icon placeholder */}
        <div className="absolute inset-0 flex items-center justify-center">
          <School className="w-8 h-8 text-sidebar-foreground/40 animate-pulse" />
        </div>
      </motion.div>

      {/* School name placeholder */}
      <motion.div
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: 'auto', opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="relative h-4 w-24 rounded overflow-hidden"
      >
        {/* Background with gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-sidebar-accent via-sidebar-accent/80 to-sidebar-accent" />
        
        {/* Shimmer effect */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent"
          animate={{
            x: ['-100%', '200%'],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "linear",
            delay: 0.3,
          }}
        />
      </motion.div>

      {/* Motto placeholder */}
      <motion.div
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: 'auto', opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="relative h-3 w-20 rounded overflow-hidden"
      >
        {/* Background with gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-sidebar-accent/80 via-sidebar-accent/60 to-sidebar-accent/80" />
        
        {/* Shimmer effect */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
          animate={{
            x: ['-100%', '200%'],
          }}
          transition={{
            duration: 1.8,
            repeat: Infinity,
            ease: "linear",
            delay: 0.5,
          }}
        />
      </motion.div>

      {/* Subtle pulsing dots indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex items-center space-x-1 mt-1"
      >
        {[0, 1, 2].map((index) => (
          <motion.div
            key={index}
            className="w-1 h-1 rounded-full bg-sidebar-foreground/30"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: index * 0.2,
              ease: "easeInOut",
            }}
          />
        ))}
      </motion.div>
    </motion.div>
  );
}

