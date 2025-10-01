"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import Webcam from 'react-webcam';
import { Button } from '@/components/ui/button';
import { ModernDialog, ModernDialogContent, ModernDialogHeader, ModernDialogTitle, ModernDialogTrigger } from '@/components/ui/modern-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, Upload, X, RotateCcw, Check, RefreshCw, Minimize2, Maximize2 } from 'lucide-react';
import Image from 'next/image';
import { EnhancedButton } from '@/components/ui/enhanced-button';
// CSS is imported in globals.css

interface PhotoUploadCropProps {
  onPhotoChange: (photo: string | undefined) => void;
  currentPhoto?: string;
  className?: string;
}

// Helper function to create a crop centered and with aspect ratio 1:1
function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number,
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  )
}

// Helper function to compress image to under 500KB
function compressImage(canvas: HTMLCanvasElement, quality = 0.85): Promise<string> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve('');
        return;
      }
      
      // Target maximum file size of 500KB
      const maxSize = 500 * 1024; // 500KB
      
      // If image is already under max size, return as is
      if (blob.size <= maxSize) {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
        return;
      }
      
      // Reduce quality and try again
      if (quality > 0.3) {
        canvas.toBlob((compressedBlob) => {
          if (compressedBlob) {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(compressedBlob);
          } else {
            resolve('');
          }
        }, 'image/jpeg', quality - 0.1);
      } else {
        // If we can't compress enough with quality, resize the canvas
        const newCanvas = document.createElement('canvas');
        const ctx = newCanvas.getContext('2d');
        const scaleFactor = Math.sqrt(maxSize / blob.size) * 0.9;
        
        newCanvas.width = Math.max(800, canvas.width * scaleFactor); // Ensure minimum 800px to maintain our standard
        newCanvas.height = Math.max(800, canvas.height * scaleFactor);
        
        if (ctx) {
          ctx.drawImage(canvas, 0, 0, newCanvas.width, newCanvas.height);
          newCanvas.toBlob((finalBlob) => {
            if (finalBlob) {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(finalBlob);
            } else {
              resolve('');
            }
          }, 'image/jpeg', 0.8);
        } else {
          resolve('');
        }
      }
    }, 'image/jpeg', quality);
  });
}

export function PhotoUploadCrop({ onPhotoChange, currentPhoto, className }: PhotoUploadCropProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [mode, setMode] = useState<'select' | 'camera' | 'upload' | 'crop'>('select');
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isProcessing, setIsProcessing] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment'); // Default to back camera
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | undefined>(undefined);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [maxResolution, setMaxResolution] = useState<{width: number, height: number} | null>(null);
  
  const imgRef = useRef<HTMLImageElement>(null);
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, 1));
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImgSrc(reader.result as string);
        setMode('crop');
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const capturePhoto = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setImgSrc(imageSrc);
      setMode('crop');
      setIsFullscreen(false); // Exit fullscreen after capture
    }
  }, []);

  const getCroppedImg = useCallback(async () => {
    if (!imgRef.current || !completedCrop) return;

    setIsProcessing(true);
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      setIsProcessing(false);
      return;
    }

    const image = imgRef.current;
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // Calculate the actual crop dimensions in the original image
    const cropWidth = completedCrop.width * scaleX;
    const cropHeight = completedCrop.height * scaleY;
    const cropSize = Math.min(cropWidth, cropHeight); // Since it's a square crop
    
    // Instead of forcing 800x800, use the actual crop size but ensure minimum quality
    const MIN_OUTPUT_SIZE = 400; // Minimum acceptable size
    const MAX_OUTPUT_SIZE = 1200; // Maximum size to keep file manageable
    
    // Determine optimal output size based on actual crop size
    let outputSize = Math.round(cropSize);
    
    // Ensure we don't make tiny images huge or huge images unwieldy
    if (outputSize < MIN_OUTPUT_SIZE) {
      outputSize = MIN_OUTPUT_SIZE;
    } else if (outputSize > MAX_OUTPUT_SIZE) {
      outputSize = MAX_OUTPUT_SIZE;
    }
    
    // Set canvas size to the calculated optimal size
    canvas.width = outputSize;
    canvas.height = outputSize;

    // Calculate source crop area
    const sourceX = completedCrop.x * scaleX;
    const sourceY = completedCrop.y * scaleY;
    const sourceSize = cropSize;

    // Draw the image with proper scaling
    ctx.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      outputSize,
      outputSize
    );

    try {
      const compressedDataUrl = await compressImage(canvas);
      onPhotoChange(compressedDataUrl);
      setIsDialogOpen(false);
      setMode('select');
      setImgSrc('');
    } catch (error) {
      console.error('Error processing image:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [completedCrop, onPhotoChange]);

  const resetDialog = () => {
    setMode('select');
    setImgSrc('');
    setCrop(undefined);
    setCompletedCrop(undefined);
    setFacingMode('environment'); // Reset to back camera
    setIsFullscreen(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const switchCamera = () => {
    // Toggle between front and back camera
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    setSelectedCameraId(undefined); // Reset to allow facingMode to work
  };

  const toggleFullscreen = () => {
    setIsFullscreen(prev => !prev);
  };

  const removePhoto = () => {
    onPhotoChange(undefined);
  };

  // Get available cameras and their maximum resolution capabilities
  useEffect(() => {
    const getCamerasAndCapabilities = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setAvailableCameras(videoDevices);
        
        // Automatically select the best camera based on facingMode
        if (videoDevices.length > 0) {
          const currentCamera = videoDevices.find(device => {
            const deviceLabel = device.label.toLowerCase();
            if (facingMode === 'environment') {
              // Prefer cameras that don't say "front" or "wide" - prioritize main camera
              return !deviceLabel.includes('front') && !deviceLabel.includes('wide');
            }
            // Prefer cameras that say "front" for user facing mode
            return deviceLabel.includes('front');
          });
          
          // If no specific camera found, try to find main camera for environment mode
          const fallbackCamera = facingMode === 'environment' 
            ? videoDevices.find(device => {
                const label = device.label.toLowerCase();
                return label.includes('main') || label.includes('primary') || (!label.includes('front') && !label.includes('wide'));
              })
            : videoDevices.find(device => device.label.toLowerCase().includes('front'));
          
          const selectedDevice = currentCamera?.deviceId || fallbackCamera?.deviceId || videoDevices[0].deviceId;
          setSelectedCameraId(selectedDevice);
          
          // Get maximum resolution for the selected camera
          if (selectedDevice) {
            try {
              const stream = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: { exact: selectedDevice } }
              });
              
              const track = stream.getVideoTracks()[0];
              const capabilities = track.getCapabilities?.();
              
              if (capabilities?.width && capabilities?.height) {
                const maxWidth = Array.isArray(capabilities.width) ? Math.max(...capabilities.width) : 
                  (typeof capabilities.width === 'object' && 'max' in capabilities.width) ? capabilities.width.max : capabilities.width;
                const maxHeight = Array.isArray(capabilities.height) ? Math.max(...capabilities.height) : 
                  (typeof capabilities.height === 'object' && 'max' in capabilities.height) ? capabilities.height.max : capabilities.height;
                
                // Set reasonable maximums to avoid extreme resolutions
                const finalWidth = Math.min(Number(maxWidth), 4096);
                const finalHeight = Math.min(Number(maxHeight), 4096);
                
                setMaxResolution({ width: finalWidth, height: finalHeight });
                console.log(`Camera max resolution detected: ${finalWidth}x${finalHeight}`);
              } else {
                // Fallback to high-quality defaults if capabilities not available
                setMaxResolution({ width: 1920, height: 1080 });
                console.log('Camera capabilities not available, using default max resolution: 1920x1080');
              }
              
              // Clean up the test stream
              stream.getTracks().forEach(track => track.stop());
            } catch (error) {
              console.warn('Could not get camera capabilities:', error);
              // Fallback to high-quality defaults
              setMaxResolution({ width: 1920, height: 1080 });
            }
          }
        }
      } catch (error) {
        console.error("Error enumerating devices:", error);
        // Fallback resolution
        setMaxResolution({ width: 1920, height: 1080 });
      }
    };

    if (mode === 'camera') {
      getCamerasAndCapabilities();
    }
  }, [mode, facingMode]);

  const handleCameraChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCameraId(event.target.value);
  };

  // Helper function to categorize cameras by lens type
  const categorizeCameras = (cameras: MediaDeviceInfo[]) => {
    const categories = {
      main: [] as MediaDeviceInfo[],
      wide: [] as MediaDeviceInfo[],
      ultraWide: [] as MediaDeviceInfo[],
      telephoto: [] as MediaDeviceInfo[],
      front: [] as MediaDeviceInfo[],
      other: [] as MediaDeviceInfo[]
    };

    cameras.forEach(camera => {
      const label = camera.label.toLowerCase();
      
      if (label.includes('front') || label.includes('user')) {
        categories.front.push(camera);
      } else if (label.includes('telephoto') || label.includes('tele')) {
        categories.telephoto.push(camera);
      } else if (label.includes('ultra') || label.includes('0.5')) {
        categories.ultraWide.push(camera);
      } else if (label.includes('wide') && !label.includes('ultra')) {
        categories.wide.push(camera);
      } else if (label.includes('main') || label.includes('primary') || 
                 (!label.includes('front') && !label.includes('wide') && !label.includes('telephoto'))) {
        categories.main.push(camera);
      } else {
        categories.other.push(camera);
      }
    });

    return categories;
  };

  // Helper function to get lens type icon
  const getLensIcon = (lensType: string) => {
    switch (lensType) {
      case 'main': return '📷';
      case 'wide': return '📐';
      case 'ultraWide': return '🌐';
      case 'telephoto': return '🔭';
      case 'front': return '🤳';
      default: return '📹';
    }
  };

  // Helper function to get lens type label
  const getLensLabel = (lensType: string) => {
    switch (lensType) {
      case 'main': return 'Main';
      case 'wide': return 'Wide';
      case 'ultraWide': return 'Ultra Wide';
      case 'telephoto': return 'Telephoto';
      case 'front': return 'Front';
      default: return 'Other';
    }
  };

  const switchToLensType = (lensType: string) => {
    const categories = categorizeCameras(availableCameras);
    const cameras = categories[lensType as keyof typeof categories];
    
    if (cameras.length > 0) {
      setSelectedCameraId(cameras[0].deviceId);
      // Update facing mode based on lens type
      if (lensType === 'front') {
        setFacingMode('user');
      } else {
        setFacingMode('environment');
      }
    }
  };

  return (
    <div className={className}>
      <div className="flex flex-col items-center space-y-4">
        <div className="relative">
          {currentPhoto ? (
            <div className="relative">
              <Image
                src={currentPhoto}
                alt="Pupil photo"
                width={150}
                height={150}
                className="rounded-full object-cover border-4 border-blue-200 dark:border-blue-800"
              />
              <Button
                variant="destructive"
                size="sm"
                className="absolute -top-2 -right-2 rounded-full h-8 w-8 p-0"
                onClick={removePhoto}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="w-[150px] h-[150px] rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center border-4 border-dashed border-gray-300 dark:border-gray-600">
              <Camera className="h-12 w-12 text-gray-400" />
            </div>
          )}
        </div>

        <ModernDialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetDialog();
        }}>
          <ModernDialogTrigger asChild>
            <Button variant="outline" className="w-full">
              <Upload className="mr-2 h-4 w-4" />
              {currentPhoto ? 'Change Photo' : 'Add Photo'}
            </Button>
          </ModernDialogTrigger>
          <ModernDialogContent 
            size={isFullscreen ? "full" : "lg"} 
            className={
              isFullscreen 
                ? "camera-fullscreen-dialog" 
                : "compact-camera-dialog"
            }
          >
            <ModernDialogHeader className={isFullscreen ? "absolute top-0 left-0 right-0 z-10 bg-black/80 text-white p-4" : "pb-2"}>
              <ModernDialogTitle className={isFullscreen ? "text-white" : ""}>
                {mode === 'select' && 'Choose Photo Source'}
                {mode === 'upload' && 'Upload Photo'}
                {mode === 'crop' && 'Crop Photo'}
              </ModernDialogTitle>
            </ModernDialogHeader>

            <div className={`${isFullscreen ? 'pt-16 h-full' : 'space-y-3'}`}>
              {mode === 'select' && (
                <div className="grid grid-cols-2 gap-4">
                  <Card className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800" onClick={() => setMode('camera')}>
                    <CardContent className="flex flex-col items-center justify-center p-6">
                      <Camera className="h-12 w-12 text-blue-600 mb-2" />
                      <span className="font-medium">Take Photo</span>
                      <span className="text-sm text-gray-500">Use camera</span>
                    </CardContent>
                  </Card>
                  <Card className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800" onClick={() => fileInputRef.current?.click()}>
                    <CardContent className="flex flex-col items-center justify-center p-6">
                      <Upload className="h-12 w-12 text-green-600 mb-2" />
                      <span className="font-medium">Upload File</span>
                      <span className="text-sm text-gray-500">Choose from device</span>
                    </CardContent>
                  </Card>
                </div>
              )}

              {mode === 'camera' && (
                <div className={`camera-interface ${isFullscreen ? 'h-full flex flex-col' : ''}`}>
                  {/* Camera Controls Header - Always visible */}
                  <div className={`flex items-center justify-between gap-1 ${isFullscreen ? 'absolute top-16 left-4 right-4 z-20 bg-black/60 backdrop-blur-sm rounded-lg p-2' : 'px-2 mb-2'}`}>
                    <div className="flex items-center gap-1">
                      {/* Camera Selection */}
                      {availableCameras.length > 1 && (
                        <EnhancedButton
                          type="button"
                          variant="outline"
                          size="sm"
                          className={`camera-action-button text-xs px-2 py-1 h-7 ${isFullscreen ? 'bg-white/10 border-white/20 text-white hover:bg-white/20' : ''}`}
                          onClick={switchCamera}
                          leftIcon={<RotateCcw className="h-3 w-3" />}
                        >
                          <span className="hidden sm:inline text-xs">Switch</span>
                        </EnhancedButton>
                      )}
                      
                      {/* Fullscreen Toggle */}
                      <EnhancedButton
                        type="button"
                        variant="outline"
                        size="sm"
                        className={`camera-action-button text-xs px-2 py-1 h-7 ${isFullscreen ? 'bg-white/10 border-white/20 text-white hover:bg-white/20' : ''}`}
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        leftIcon={isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                      >
                        <span className="hidden sm:inline text-xs">{isFullscreen ? 'Exit' : 'Full'}</span>
                      </EnhancedButton>
                    </div>
                  </div>

                  {/* Camera Container with Lens Switcher directly attached */}
                  <div className="relative">
                    <div className={`camera-viewfinder relative ${isFullscreen ? 'flex-1 flex items-center justify-center' : 'aspect-[3/4] bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700'}`}>
                      <Webcam
                        ref={webcamRef}
                        screenshotFormat="image/jpeg"
                        screenshotQuality={0.95}
                        className={`w-full h-full object-cover enhanced-camera-video ${isFullscreen ? 'max-w-full max-h-full' : ''}`}
                        videoConstraints={{
                          // Always use maximum available resolution for best quality
                          width: maxResolution ? { ideal: maxResolution.width, min: 1280 } : { ideal: 1920, min: 1280 },
                          height: maxResolution ? { ideal: maxResolution.height, min: 720 } : { ideal: 1080, min: 720 },
                          frameRate: { ideal: 30, max: 60 },
                          ...(selectedCameraId ? { deviceId: { exact: selectedCameraId } } : { facingMode }),
                        }}
                      />
                    </div>

                    {/* Lens Switcher - Directly attached to viewfinder */}
                    {!isFullscreen && availableCameras.length > 1 && (() => {
                      const categories = categorizeCameras(availableCameras);
                      const availableLensTypes = Object.entries(categories).filter(([_, cameras]) => cameras.length > 0);
                      
                      return availableLensTypes.length > 1 && (
                        <div className="px-1">
                          {/* Quick Lens Switcher */}
                          <div className="flex flex-wrap justify-center gap-1 py-1">
                            {availableLensTypes.map(([lensType, cameras]) => {
                              const isActive = cameras.some(camera => camera.deviceId === selectedCameraId);
                              return (
                                <EnhancedButton
                                  key={lensType}
                                  variant={isActive ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => switchToLensType(lensType)}
                                  className="flex items-center gap-1 text-xs px-2 py-1 h-6 min-w-[50px]"
                                  title={`Switch to ${getLensLabel(lensType)} camera (${cameras.length} available)`}
                                >
                                  <span className="text-xs">{getLensIcon(lensType)}</span>
                                  <span className="hidden sm:inline text-xs">{getLensLabel(lensType)}</span>
                                  {cameras.length > 1 && (
                                    <span className="bg-gray-200 dark:bg-gray-600 text-xs px-1 rounded">
                                      {cameras.length}
                                    </span>
                                  )}
                                </EnhancedButton>
                              );
                            })}
                          </div>
                          
                          {/* Advanced Camera Dropdown */}
                          <div className="w-full px-1">
                            <select
                              value={selectedCameraId || ''}
                              onChange={handleCameraChange}
                              className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              title="Select specific camera"
                            >
                              {availableCameras.map(device => (
                                <option key={device.deviceId} value={device.deviceId}>
                                  {device.label || `Camera ${availableCameras.indexOf(device) + 1}`}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Camera Action Buttons - Outside viewfinder */}
                  <div className={`camera-controls-bottom ${isFullscreen ? 'absolute bottom-4 left-4 right-4 z-20' : 'py-2'}`}>
                    <div className={`flex items-center justify-center gap-2 ${isFullscreen ? 'bg-black/60 backdrop-blur-sm rounded-lg p-3' : ''}`}>
                      {/* Retake Button */}
                      <EnhancedButton
                        type="button"
                        variant="outline"
                        size="sm"
                        className={`camera-action-button back-button essential h-8 min-w-[60px] text-xs ${isFullscreen ? 'bg-white/10 border-white/20 text-white hover:bg-white/20' : ''}`}
                        onClick={() => {
                          setImgSrc('')
                          setMode('camera')
                        }}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        <span className="text-xs">Retake</span>
                      </EnhancedButton>
                      
                      {/* Capture Button - Circular */}
                      <EnhancedButton
                        type="button"
                        variant="default"
                        size="icon"
                        className={`camera-capture-button essential rounded-full ${isFullscreen ? 'bg-white hover:bg-gray-100 text-black w-16 h-16' : 'bg-white hover:bg-gray-100 text-black w-12 h-12 shadow-lg border-2 border-gray-300'}`}
                        onClick={capturePhoto}
                        ripple
                      >
                        <Camera className={isFullscreen ? "h-8 w-8" : "h-5 w-5"} />
                      </EnhancedButton>
                      
                      {/* Switch Camera (Mobile) */}
                      {availableCameras.length > 1 && (
                        <EnhancedButton
                          type="button"
                          variant="outline"
                          size="sm"
                          className={`camera-action-button switch-camera essential h-8 min-w-[60px] text-xs ${isFullscreen ? 'bg-white/10 border-white/20 text-white hover:bg-white/20' : ''}`}
                          onClick={switchCamera}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          <span className="text-xs">Flip</span>
                        </EnhancedButton>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {mode === 'crop' && imgSrc && (
                <div className="space-y-4">
                  <div className="max-h-[60vh] overflow-auto rounded-lg border border-gray-200 dark:border-gray-700">
                    <ReactCrop
                      crop={crop}
                      onChange={(_, percentCrop) => setCrop(percentCrop)}
                      onComplete={(c) => setCompletedCrop(c)}
                      aspect={1}
                      circularCrop
                      className="max-w-full"
                    >
                      <img
                        ref={imgRef}
                        alt="Crop me"
                        src={imgSrc}
                        onLoad={onImageLoad}
                        className="max-w-full h-auto object-contain"
                      />
                    </ReactCrop>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button 
                      onClick={getCroppedImg} 
                      disabled={!completedCrop || isProcessing}
                      className="flex-1"
                    >
                      <Check className="mr-2 h-4 w-4" />
                      {isProcessing ? 'Processing...' : 'Save Photo'}
                    </Button>
                    <Button variant="outline" onClick={() => setMode('select')} className="flex-1 sm:flex-none">
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </ModernDialogContent>
        </ModernDialog>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>
    </div>
  );
} 