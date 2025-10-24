"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import Webcam from 'react-webcam';
import { Button } from '@/components/ui/button';
import { ModernDialog, ModernDialogContent, ModernDialogHeader, ModernDialogTitle, ModernDialogTrigger } from '@/components/ui/modern-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, Upload, X, RotateCcw, Check, Plus, Edit, Download, RefreshCw, Minimize2, Maximize2, ArrowLeft } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EnhancedButton } from '@/components/ui/enhanced-button';

interface PupilPhotoDetailProps {
  pupilPhoto?: string;
  pupilName: string;
  onPhotoChange: (photo: string | undefined) => void;
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

const TARGET_BLOB_SIZE_BYTES = 200 * 1024; // 200KB maximum file size - optimized for pupil profiles

// Helper function to compress image with smart quality optimization
function compressImage(canvas: HTMLCanvasElement, initialQuality = 0.92): Promise<string> {
  return new Promise((resolve, reject) => {
    let currentQuality = initialQuality;
    const maxSize = TARGET_BLOB_SIZE_BYTES; // 200KB for all images
    
    console.log(`📸 Starting image compression - Target: ${(maxSize / 1024).toFixed(0)}KB`);
    
    const attemptCompression = () => {
      canvas.toBlob((blob) => {
        if (!blob) {
          console.error('Canvas toBlob returned null');
          reject(new Error('Failed to convert canvas to blob.'));
          return;
        }

        const currentSizeKB = (blob.size / 1024).toFixed(1);
        console.log(`📊 Current size: ${currentSizeKB}KB at quality ${currentQuality.toFixed(2)}`);

        if (blob.size <= maxSize) {
          console.log(`✅ Compression successful: ${currentSizeKB}KB (quality: ${currentQuality.toFixed(2)})`);
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('FileReader error during compression.'));
          reader.readAsDataURL(blob);
          return;
        }

        // If blob is too large, try reducing quality with smart stepping
        if (currentQuality > 0.35) {
          // Use adaptive quality reduction based on how far we are from target
          const sizeRatio = blob.size / maxSize;
          const qualityReduction = sizeRatio > 2 ? 0.12 : 0.08; // Faster reduction for very large images
          currentQuality = Math.max(0.35, currentQuality - qualityReduction);
          console.log(`🔄 Reducing quality to ${currentQuality.toFixed(2)}`);
          attemptCompression(); // Retry with lower quality
        } else {
          // Quality is at minimum, try smart resizing
          console.log(`🔄 Quality at minimum, resizing canvas...`);
          const newCanvas = document.createElement('canvas');
          const ctx = newCanvas.getContext('2d');
          
          // Calculate scaleFactor to target slightly below 200KB to account for JPEG artifacts
          const scaleFactor = Math.sqrt(maxSize / blob.size) * 0.88;
          
          // Ensure minimum dimensions for acceptable quality while targeting 200KB
          const minDimension = 600; // Lowered from 800 to allow more compression room
          newCanvas.width = Math.max(minDimension, Math.round(canvas.width * scaleFactor));
          newCanvas.height = Math.max(minDimension, Math.round(canvas.height * scaleFactor));
          
          console.log(`📐 Resizing from ${canvas.width}x${canvas.height} to ${newCanvas.width}x${newCanvas.height}`);
          
          if (ctx) {
            // Use high-quality image smoothing
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(canvas, 0, 0, newCanvas.width, newCanvas.height);
            
            // After resizing, try to compress again with good quality
            currentQuality = 0.85; // Reset to good quality for the resized image
            canvas = newCanvas; // Replace original canvas with resized one
            console.log(`✅ Canvas resized, retrying compression at quality ${currentQuality}`);
            attemptCompression();
          } else {
            console.error('Failed to get 2D context from new canvas during resize');
            reject(new Error('Failed to resize image for compression.'));
          }
        }
      }, 'image/jpeg', currentQuality);
    };
    attemptCompression();
  });
}

// Helper function to download image
function downloadImage(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function PupilPhotoDetail({ pupilPhoto, pupilName, onPhotoChange, className }: PupilPhotoDetailProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [mode, setMode] = useState<'select' | 'camera' | 'upload' | 'crop' | 'view' | 'actions'>('select');
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isProcessing, setIsProcessing] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
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
        const result = reader.result as string;
        const trimmedResult = result ? result.trim() : '';
        setImgSrc(trimmedResult ? trimmedResult : null);
        setMode('crop');
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const capturePhoto = useCallback(() => {
    const imageSrcFromWebcam = webcamRef.current?.getScreenshot();
    const trimmedWebcamSrc = imageSrcFromWebcam ? imageSrcFromWebcam.trim() : '';
    if (trimmedWebcamSrc) {
      setImgSrc(trimmedWebcamSrc);
      setMode('crop');
      setIsFullscreen(false); // Exit fullscreen after capture
    } else {
      setImgSrc(null);
    }
  }, []);

  const getCroppedImg = useCallback(async () => {
    if (!imgRef.current || !completedCrop || !imgSrc) {
        setIsProcessing(false);
        return;
    }

    setIsProcessing(true);
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      console.error('Failed to get 2D context for cropping');
      // Consider showing a toast error to the user here as well
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
      // Reset mode for next time dialog opens
      setMode('select');
      setImgSrc(null); 
    } catch (error: any) { // Added type annotation for error
      console.error('Error processing image:', error);
      // Show a toast notification to the user about the compression failure
      // This assumes you have a toast system like react-toastify or similar
      // For example: toast.error(`Image compression failed: ${error.message}`);
      alert(`Image compression failed: ${error.message}. Please try a different image or check its format.`); // Simple alert for now
    } finally {
      setIsProcessing(false);
    }
  }, [completedCrop, onPhotoChange, imgSrc]);

  const resetDialog = () => {
    // Reset to appropriate mode based on whether pupil has a photo
    const effectivePhoto = (pupilPhoto && typeof pupilPhoto === 'string' && pupilPhoto.trim()) ? pupilPhoto.trim() : undefined;
    setMode(effectivePhoto ? 'actions' : 'select');
    setImgSrc(null);
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
        // Handle error (e.g., show a toast to the user)
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

  const handleDownload = () => {
    const trimmedPupilPhoto = pupilPhoto && typeof pupilPhoto === 'string' ? pupilPhoto.trim() : '';
    if (trimmedPupilPhoto) {
      const filename = `${pupilName.toUpperCase().replace(/\s+/g, '_')}_PHOTO.jpg`;
      downloadImage(trimmedPupilPhoto, filename);
    }
  };

  const handleEdit = () => {
    const trimmedPupilPhoto = pupilPhoto && typeof pupilPhoto === 'string' ? pupilPhoto.trim() : '';
    if (trimmedPupilPhoto) {
      setImgSrc(trimmedPupilPhoto);
      setMode('crop');
    } else {
      setImgSrc(null);
      setMode('select');
    }
  };

  const handleChange = () => {
    setMode('select');
  };

  const handlePhotoClick = () => {
    const effectivePhoto = (pupilPhoto && typeof pupilPhoto === 'string' && pupilPhoto.trim()) ? pupilPhoto.trim() : undefined;
    if (effectivePhoto) {
      setMode('actions');
      setIsDialogOpen(true);
    } else {
      setMode('select');
      setIsDialogOpen(true);
    }
  };

  const getInitials = () => {
    const names = pupilName.trim().split(' ').filter(name => name.length > 0);
    return names.length >= 2 ? `${names[0][0]}${names[1][0]}` : names[0]?.[0] || 'P';
  };

  // For debugging pupilPhoto on initial load
  const effectiveSrc = (pupilPhoto && typeof pupilPhoto === 'string' && pupilPhoto.trim()) ? pupilPhoto.trim() : undefined;
  console.log('[PupilPhotoDetail] Received pupilPhoto:', pupilPhoto);
  console.log('[PupilPhotoDetail] Effective src for AvatarImage:', effectiveSrc);

  // Reset image states when effectiveSrc changes
  React.useEffect(() => {
    console.log('[PupilPhotoDetail] effectiveSrc changed, resetting image states');
    setImageLoaded(false);
    setImageError(false);
  }, [effectiveSrc]);

  // Debug image states
  React.useEffect(() => {
    console.log('[PupilPhotoDetail] Image states:', { imageLoaded, imageError, effectiveSrc: !!effectiveSrc });
  }, [imageLoaded, imageError, effectiveSrc]);

  return (
    <div className={className}>
      <div className="flex flex-col items-center">
        <ModernDialog 
          open={isDialogOpen} 
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetDialog();
          }}
        >
          <ModernDialogTrigger asChild>
            <div className={`relative cursor-pointer ${className}`} onClick={handlePhotoClick}>
              <Avatar className="h-24 w-24 cursor-pointer transition-opacity hover:opacity-80">
            <AvatarImage
              src={effectiveSrc}
              alt={pupilName}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                />
                <AvatarFallback className="text-lg font-bold bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                      {getInitials()}
              </AvatarFallback>
          </Avatar>
          
              {/* Overlay with hover effect */}
              <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors duration-200 rounded-full flex items-center justify-center">
                <div className="opacity-0 hover:opacity-100 transition-opacity duration-200 bg-white/90 rounded-full p-2">
                  {effectiveSrc ? <Edit className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </div>
              </div>
            </div>
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
                {mode === 'view' && `${pupilName}'s Photo - Full Screen View`}
                {mode === 'actions' && 'Photo Actions'}
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

              {mode === 'actions' && effectiveSrc && (
                <div className="space-y-3">
                  <div className="flex justify-center">
                    <img 
                      src={effectiveSrc} 
                      alt={`${pupilName} - Current Photo`} 
                      className="max-w-full max-h-80 rounded-lg object-contain shadow-lg cursor-pointer hover:scale-105 transition-transform duration-200"
                      onClick={() => setMode('view')}
                      title="Click to view full screen"
                    />
                  </div>
                  <div className="flex justify-center gap-1 sm:gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMode('view')}
                      className="flex items-center gap-1 px-2 sm:px-3 py-2 min-w-0"
                      title="View full screen"
                    >
                      <Maximize2 className="h-4 w-4 flex-shrink-0" />
                      <span className="hidden sm:inline">View</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleEdit}
                      className="flex items-center gap-1 px-2 sm:px-3 py-2 min-w-0"
                      title="Edit photo"
                    >
                      <Edit className="h-4 w-4 flex-shrink-0" />
                      <span className="hidden sm:inline">Edit</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleChange}
                      className="flex items-center gap-1 px-2 sm:px-3 py-2 min-w-0"
                      title="Change photo"
                    >
                      <RefreshCw className="h-4 w-4 flex-shrink-0" />
                      <span className="hidden sm:inline">Change</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownload}
                      className="flex items-center gap-1 px-2 sm:px-3 py-2 min-w-0"
                      title="Download photo"
                    >
                      <Download className="h-4 w-4 flex-shrink-0" />
                      <span className="hidden sm:inline">Download</span>
                    </Button>
                  </div>
                </div>
              )}

              {mode === 'view' && effectiveSrc && (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <img 
                      src={effectiveSrc} 
                      alt={`${pupilName} - Full Screen Photo`} 
                      className="max-w-full max-h-[70vh] rounded-lg object-contain shadow-lg"
                    />
                  </div>
                  <div className="flex justify-center gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete ${pupilName}'s photo?`)) {
                          onPhotoChange(undefined);
                          setIsDialogOpen(false);
                        }
                      }}
                      className="flex items-center gap-2"
                      title="Delete photo"
                    >
                      <X className="h-4 w-4" />
                      Delete
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        const filename = `${pupilName.toUpperCase().replace(/\s+/g, '_')}_PHOTO.jpg`;
                        downloadImage(effectiveSrc, filename);
                      }}
                      className="flex items-center gap-2"
                      title="Download photo"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMode('actions')}
                      className="flex items-center gap-2"
                      title="Back to actions"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </Button>
                  </div>
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
                    <div className={`camera-viewfinder relative ${isFullscreen ? 'flex-1 flex items-center justify-center' : 'aspect-[3/4] bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden'}`}>
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
                      {/* Back Button */}
                      <EnhancedButton
                        type="button"
                        variant="outline"
                        size="sm"
                        className={`camera-action-button back-button essential h-8 min-w-[60px] text-xs ${isFullscreen ? 'bg-white/10 border-white/20 text-white hover:bg-white/20' : ''}`}
                        onClick={() => {
                          // Go back to select mode (Choose Photo Source) when coming from camera
                          setMode('select');
                        }}
                      >
                        <ArrowLeft className="h-3 w-3 mr-1" />
                        <span className="text-xs">Back</span>
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
                  <div className="max-h-96 overflow-auto">
                    <ReactCrop
                      crop={crop}
                      onChange={(_, percentCrop) => setCrop(percentCrop)}
                      onComplete={(c) => setCompletedCrop(c)}
                      aspect={1}
                      circularCrop
                    >
                      <img
                        ref={imgRef}
                        alt="Crop me"
                        src={imgSrc || undefined}
                        onLoad={onImageLoad}
                        className="max-w-full"
                      />
                    </ReactCrop>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={getCroppedImg} 
                      disabled={!completedCrop || isProcessing}
                      className="flex-1"
                    >
                      <Check className="mr-2 h-4 w-4" />
                      {isProcessing ? 'Processing...' : 'Save Photo'}
                    </Button>
                    <Button variant="outline" onClick={() => {
                      // If we're cropping a new photo (from camera/upload), go back to select
                      // If we're editing an existing photo, go back to actions
                      const isEditingExistingPhoto = effectiveSrc && imgSrc === effectiveSrc;
                      setMode(isEditingExistingPhoto ? 'actions' : 'select');
                    }}>
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
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>
    </div>
  );
} 