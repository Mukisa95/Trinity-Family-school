"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, CreditCard, BookOpen, Info } from 'lucide-react';
import { motion } from 'framer-motion';

interface PupilNavigationTileProps {
  pupilName: string;
  activeView: 'info' | 'fees';
  onViewChange: (view: 'info' | 'fees') => void;
  className?: string;
}

export function PupilNavigationTile({ 
  pupilName, 
  activeView, 
  onViewChange, 
  className = '' 
}: PupilNavigationTileProps) {
  const navigationItems = [
    {
      id: 'info' as const,
      label: 'Pupil Info',
      icon: User,
      description: 'Personal & School Information',
      gradient: 'from-blue-500 to-indigo-600',
      color: 'blue'
    },
    {
      id: 'fees' as const,
      label: 'Fees',
      icon: CreditCard,
      description: 'Payment & Fee Information',
      gradient: 'from-green-500 to-emerald-600',
      color: 'green'
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={`bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-gray-200 dark:border-gray-700 shadow-lg ${className}`}>
        <CardContent className="p-4 sm:p-6">
          {/* Header */}
          <div className="flex items-center mb-4">
            <div className="bg-gradient-to-r from-purple-500 to-pink-600 p-2 rounded-lg mr-3">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-lg">
                {pupilName}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Navigate between sections
              </p>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {navigationItems.map((item) => {
              const isActive = activeView === item.id;
              const Icon = item.icon;
              
              return (
                <motion.div
                  key={item.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    onClick={() => onViewChange(item.id)}
                    variant={isActive ? "default" : "outline"}
                    className={`
                      w-full h-auto p-4 flex flex-col items-center space-y-2 transition-all duration-200
                      ${isActive 
                        ? `bg-gradient-to-r ${item.gradient} text-white shadow-md border-0 hover:shadow-lg` 
                        : `border-2 border-gray-200 dark:border-gray-700 hover:border-${item.color}-300 dark:hover:border-${item.color}-600 hover:bg-${item.color}-50 dark:hover:bg-${item.color}-900/20`
                      }
                    `}
                  >
                    <Icon className={`h-6 w-6 ${isActive ? 'text-white' : `text-${item.color}-600 dark:text-${item.color}-400`}`} />
                    <div className="text-center">
                      <div className={`font-semibold text-sm ${isActive ? 'text-white' : `text-${item.color}-700 dark:text-${item.color}-300`}`}>
                        {item.label}
                      </div>
                      <div className={`text-xs ${isActive ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
                        {item.description}
                      </div>
                    </div>
                  </Button>
                </motion.div>
              );
            })}
          </div>

          {/* Active Section Indicator */}
          <div className="mt-4 p-3 bg-white/60 dark:bg-gray-800/40 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <Info className="h-4 w-4 text-blue-500 mr-2" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Currently viewing: <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {navigationItems.find(item => item.id === activeView)?.label}
                </span>
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
} 