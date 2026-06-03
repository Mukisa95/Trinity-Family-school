"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Palette } from 'lucide-react';
import type { EventType } from '@/types';

interface ColorLegendProps {
  colors: Record<EventType, string>;
  className?: string;
}

export function ColorLegend({ colors, className = "" }: ColorLegendProps) {
  return (
    <Card className={`shadow-lg border-0 bg-gradient-to-br from-white to-gray-50 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Palette className="h-5 w-5 text-blue-600" />
          Color Legend
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {Object.entries(colors).map(([type, color]) => (
          <div key={type} className="flex items-center gap-3">
            <div 
              className="w-4 h-4 rounded border shadow-sm" 
              style={{ backgroundColor: color }}
            />
            <span className="text-sm font-medium text-gray-700">
              {type}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
} 