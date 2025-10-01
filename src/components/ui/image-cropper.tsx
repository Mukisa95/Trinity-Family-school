"use client"

import React, { useState, useRef } from 'react';
import { Button } from './button';
import { X } from 'lucide-react';

interface ImageCropperProps {
  imageSrc: string;
  onCropComplete: (croppedImage: string) => void;
  onCancel: () => void;
  aspectRatio?: number;
}

export function ImageCropper({ 
  imageSrc, 
  onCropComplete, 
  onCancel,
  aspectRatio = 1
}: ImageCropperProps) {
  // In a real implementation, you would use a library like react-image-crop
  // This is a simplified placeholder implementation
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card p-6 rounded-lg shadow-lg w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Crop Profile Photo</h3>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="aspect-square overflow-hidden mb-6 bg-muted rounded-lg">
          <img
            src={imageSrc}
            alt="Preview for cropping"
            className="max-w-full h-auto"
          />
        </div>
        
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button 
            onClick={() => {
              // In a real implementation, this would return the cropped image
              // For now, we'll just pass back the original image
              onCropComplete(imageSrc);
            }}
          >
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
} 