"use client"

import React, { useState } from 'react';
import { Button } from './button';
import { X, Camera } from 'lucide-react';

interface CameraPreviewProps {
  onCapture: (photoData: string) => void;
  onClose: () => void;
}

export function CameraPreview({ onCapture, onClose }: CameraPreviewProps) {
  // In a real implementation, this would use the browser's camera API
  // This is a simplified placeholder implementation
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card p-6 rounded-lg shadow-lg w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Take Photo</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="aspect-video bg-muted rounded-lg flex flex-col items-center justify-center mb-6">
          <Camera className="h-16 w-16 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm mt-2">Camera preview not available</p>
          <p className="text-muted-foreground text-xs mt-1">Camera API would be implemented in production</p>
        </div>
        
        <div className="flex justify-between gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={() => {
              // In a real implementation, this would capture from the camera
              // For now, we'll just create a placeholder image
              const placeholderImage = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300' viewBox='0 0 300 300'%3E%3Crect fill='%23CCCCCC' width='300' height='300'/%3E%3Ctext fill='%23999999' font-family='sans-serif' font-size='30' dy='10.5' font-weight='bold' x='50%25' y='50%25' text-anchor='middle'%3ECamera Photo%3C/text%3E%3C/svg%3E";
              onCapture(placeholderImage);
            }}
          >
            Capture
          </Button>
        </div>
      </div>
    </div>
  );
} 