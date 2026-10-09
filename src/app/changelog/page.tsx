"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Sparkles, 
  Bug, 
  Zap, 
  Calendar,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { CHANGELOG, APP_VERSION } from '@/lib/constants/version';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { format } from 'date-fns';

export default function ChangelogPage() {
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-surface-50 via-white to-brand-secondary-surface-50 p-3 sm:p-4 dark:from-brand-surface-950/40 dark:via-slate-900 dark:to-brand-secondary-surface-950/40">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-4"
        >
          <div className="flex items-center justify-between mb-2">
            <Link href="/">
              <Button variant="ghost" size="sm" className="h-8 text-xs">
                <ArrowLeft className="h-3 w-3 mr-1.5" />
                Back
              </Button>
            </Link>
          </div>
          
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-brand-surface-600 to-brand-secondary-surface-600 rounded-lg mb-2 shadow-md">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-brand-ink-600 to-brand-secondary-ink-600 bg-clip-text text-transparent mb-1 dark:from-brand-ink-400 dark:to-brand-secondary-ink-400">
              Changelog
            </h1>
            <p className="text-gray-600 text-sm mb-2 dark:text-slate-300">
              Track all improvements, bug fixes, and updates
            </p>
            <Badge className="px-2.5 py-0.5 text-xs bg-gradient-to-r from-brand-surface-600 to-brand-secondary-surface-600 text-white">
              Version {APP_VERSION}
            </Badge>
          </div>
        </motion.div>

        {/* Changelog Entries */}
        <div className="space-y-3">
          {CHANGELOG.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Card className="border shadow-lg">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-brand-surface-100 to-brand-secondary-surface-100 rounded-lg flex items-center justify-center dark:from-brand-surface-950/40 dark:to-brand-secondary-surface-950/40">
                    <Sparkles className="h-6 w-6 text-gray-400 dark:text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-1 dark:text-slate-100">
                    No updates yet
                  </h3>
                  <p className="text-gray-600 text-sm dark:text-slate-300">
                    Changelog entries will appear here as you make updates to the application.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            CHANGELOG.map((entry, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="border shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-brand-surface-50 to-brand-secondary-surface-50 border-b py-3 px-4 dark:from-brand-surface-950/40 dark:to-brand-secondary-surface-950/40">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-brand-surface-600 to-brand-secondary-surface-600 rounded-md flex items-center justify-center shadow-sm">
                        <Calendar className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-bold text-gray-800 dark:text-slate-100">
                          {formatDate(entry.date)}
                        </CardTitle>
                        <Badge 
                          variant="secondary" 
                          className="mt-0.5 text-xs px-2 py-0 bg-gradient-to-r from-brand-surface-600 to-brand-secondary-surface-600 text-white"
                        >
                          v{entry.version}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="p-4 space-y-3">
                  {/* Improvements */}
                  {entry.improvements.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <div className="w-6 h-6 bg-gradient-to-br from-green-500 to-emerald-600 rounded-md flex items-center justify-center">
                          <Zap className="h-3 w-3 text-white" />
                        </div>
                        <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">
                          Improvements
                        </h3>
                      </div>
                      <ul className="space-y-1 ml-7">
                        {entry.improvements.map((improvement, idx) => (
                          <motion.li
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 + idx * 0.05 }}
                            className="flex items-start gap-1.5 text-sm text-gray-700 dark:text-slate-200"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0 dark:text-green-400" />
                            <span>{improvement}</span>
                          </motion.li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Bug Fixes */}
                  {entry.bugFixes.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <div className="w-6 h-6 bg-gradient-to-br from-red-500 to-pink-600 rounded-md flex items-center justify-center">
                          <Bug className="h-3 w-3 text-white" />
                        </div>
                        <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">
                          Bug Fixes
                        </h3>
                      </div>
                      <ul className="space-y-1 ml-7">
                        {entry.bugFixes.map((fix, idx) => (
                          <motion.li
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 + idx * 0.05 }}
                            className="flex items-start gap-1.5 text-sm text-gray-700 dark:text-slate-200"
                          >
                            <AlertCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 flex-shrink-0 dark:text-red-400" />
                            <span>{fix}</span>
                          </motion.li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Updates */}
                  {entry.updates.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <div className="w-6 h-6 bg-gradient-to-br from-brand-surface-500 to-brand-alt-surface-600 rounded-md flex items-center justify-center">
                          <RefreshCw className="h-3 w-3 text-white" />
                        </div>
                        <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">
                          Updates
                        </h3>
                      </div>
                      <ul className="space-y-1 ml-7">
                        {entry.updates.map((update, idx) => (
                          <motion.li
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 + idx * 0.05 }}
                            className="flex items-start gap-1.5 text-sm text-gray-700 dark:text-slate-200"
                          >
                            <RefreshCw className="h-3.5 w-3.5 text-brand-ink-500 mt-0.5 flex-shrink-0 dark:text-brand-ink-400" />
                            <span>{update}</span>
                          </motion.li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
            ))
          )}
        </div>

        {/* Footer Note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: CHANGELOG.length * 0.1 + 0.3 }}
          className="mt-4 text-center text-gray-500 text-xs dark:text-slate-400"
        >
          <p>Stay updated with the latest changes and improvements!</p>
        </motion.div>
      </div>
    </div>
  );
}

