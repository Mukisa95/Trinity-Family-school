"use client";

import React, { useState, useRef } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { 
  usePhotos, 
  useUpdatePhoto, 
  useDeletePhoto, 
  useSetPrimaryPhoto,
  useSearchPhotos 
} from '@/lib/hooks/use-photos';
import type { Photo, PhotoCategory, PhotoUsage } from '@/types';
import { sanitizePhotoUrl } from '@/lib/utils/photo-url-helper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ModernDialog, 
  ModernDialogContent, 
  ModernDialogHeader, 
  ModernDialogTitle, 
  ModernDialogTrigger,
  ModernDialogFooter
} from '@/components/ui/modern-dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Upload, 
  Search, 
  Edit, 
  Trash2, 
  Star, 
  StarOff, 
  Image as ImageIcon,
  Loader2,
  Plus,
  Filter,
  Grid,
  List,
  X
} from 'lucide-react';

const PHOTO_CATEGORIES: { value: PhotoCategory; label: string }[] = [
  { value: 'school_building', label: 'School Building' },
  { value: 'classroom', label: 'Classroom' },
  { value: 'playground', label: 'Playground' },
  { value: 'events', label: 'Events' },
  { value: 'staff', label: 'Staff' },
  { value: 'activities', label: 'Activities' },
  { value: 'facilities', label: 'Facilities' },
  { value: 'other', label: 'Other' },
];

const PHOTO_USAGE: { value: PhotoUsage; label: string }[] = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'homepage', label: 'Homepage' },
  { value: 'login', label: 'Login Screen' },
  { value: 'about', label: 'About Page' },
  { value: 'gallery', label: 'Gallery' },
  { value: 'background', label: 'Background' },
  { value: 'banner', label: 'Banner' },
  { value: 'general', label: 'General Use' },
];

interface UploadFormData {
  title: string;
  description: string;
  category: PhotoCategory;
  usage: PhotoUsage[];
  tags: string;
  isPrimary: boolean;
}

interface PhotoFile {
  id: string;
  file: File;
  preview: string;
  metadata: UploadFormData;
}

export function SlidesManager() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<PhotoCategory | 'all'>('all');
  const [selectedFiles, setSelectedFiles] = useState<PhotoFile[]>([]);
  const [uploadMode, setUploadMode] = useState<'individual' | 'bulk'>('bulk');
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [bulkUploadForm, setBulkUploadForm] = useState<UploadFormData>({
    title: '',
    description: '',
    category: 'other',
    usage: ['general'],
    tags: '',
    isPrimary: false,
  });

  // Queries and mutations
  const { data: photos = [], isLoading, error } = usePhotos();
  const { data: searchResults = [] } = useSearchPhotos(searchTerm, searchTerm.length > 2);
  const updateMutation = useUpdatePhoto();
  const deleteMutation = useDeletePhoto();
  const setPrimaryMutation = useSetPrimaryPhoto();

  // Filter photos
  const displayPhotos = searchTerm.length > 2 
    ? searchResults 
    : photos.filter(photo => 
        filterCategory === 'all' || photo.category === filterCategory
      );

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      const newPhotoFiles: PhotoFile[] = files.map(file => ({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        metadata: {
          title: file.name.replace(/\.[^/.]+$/, "").toUpperCase(),
          description: '',
          category: bulkUploadForm.category,
          usage: bulkUploadForm.usage,
          tags: '',
          isPrimary: false,
        }
      }));
      setSelectedFiles(prev => [...prev, ...newPhotoFiles]);
    }
  };

  const removeFile = (fileId: string) => {
    setSelectedFiles(prev => {
      const fileToRemove = prev.find(f => f.id === fileId);
      if (fileToRemove) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      return prev.filter(f => f.id !== fileId);
    });
  };

  const updateFileMetadata = (fileId: string, updates: Partial<UploadFormData>) => {
    setSelectedFiles(prev => prev.map(file => 
      file.id === fileId 
        ? { ...file, metadata: { ...file.metadata, ...updates } }
        : file
    ));
  };

  const applyBulkMetadata = () => {
    setSelectedFiles(prev => prev.map(file => ({
      ...file,
      metadata: {
        ...file.metadata,
        description: bulkUploadForm.description,
        category: bulkUploadForm.category,
        usage: bulkUploadForm.usage,
        tags: bulkUploadForm.tags,
        isPrimary: false, // Only first file can be primary in bulk mode
      }
    })));
  };

  // Helper function to compress image before upload
  const compressImage = async (file: File, maxSizeMB = 4): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Calculate new dimensions to fit under 4MB while maintaining aspect ratio
          const maxDimension = 2048; // Max width or height
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height / width) * maxDimension;
              width = maxDimension;
            } else {
              width = (width / height) * maxDimension;
              height = maxDimension;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx!.drawImage(img, 0, 0, width, height);
          
          // Try different quality levels to get under 4MB
          let quality = 0.8;
          const tryCompress = () => {
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  const sizeInMB = blob.size / 1024 / 1024;
                  console.log(`🔍 Compressed to ${sizeInMB.toFixed(2)}MB at quality ${quality}`);
                  
                  if (sizeInMB > maxSizeMB && quality > 0.3) {
                    quality -= 0.1;
                    tryCompress();
                  } else {
                    const compressedFile = new File([blob], file.name, {
                      type: 'image/jpeg',
                      lastModified: Date.now(),
                    });
                    resolve(compressedFile);
                  }
                } else {
                  reject(new Error('Failed to compress image'));
                }
              },
              'image/jpeg',
              quality
            );
          };
          tryCompress();
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0 || !user) return;

    setIsUploading(true);
    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const photoFile = selectedFiles[i];
        setUploadProgress(prev => ({ ...prev, [photoFile.id]: 0 }));
        
        // Compress image before upload to avoid Vercel's 4.5MB limit
        console.log(`📦 Original file size: ${(photoFile.file.size / 1024 / 1024).toFixed(2)}MB`);
        const compressedFile = await compressImage(photoFile.file, 4);
        console.log(`✅ Compressed file size: ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
        
        // Use the new Cloudinary API route directly
        const formData = new FormData();
        formData.append('file', compressedFile);
        formData.append('title', photoFile.metadata.title);
        formData.append('description', photoFile.metadata.description);
        formData.append('category', photoFile.metadata.category);
        formData.append('usage', JSON.stringify(photoFile.metadata.usage));
        formData.append('uploadedBy', user.id);
        formData.append('tags', photoFile.metadata.tags);
        formData.append('isPrimary', (photoFile.metadata.isPrimary && i === 0).toString());

        const response = await fetch('/api/upload-photo', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Upload failed');
        }

        const result = await response.json();
        console.log('✅ Photo uploaded successfully:', result.photo.id);

        setUploadProgress(prev => ({ ...prev, [photoFile.id]: 100 }));
      }

      // Reset form
      selectedFiles.forEach(file => URL.revokeObjectURL(file.preview));
      setSelectedFiles([]);
      setBulkUploadForm({
        title: '',
        description: '',
        category: 'other',
        usage: ['general'],
        tags: '',
        isPrimary: false,
      });
      setUploadProgress({});
      setIsUploadDialogOpen(false);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Manually refresh the photos list
      window.location.reload();
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleEdit = (photo: Photo) => {
    setEditingPhoto(photo);
    setIsEditDialogOpen(true);
  };

  const handleUpdatePhoto = async () => {
    if (!editingPhoto) return;

    try {
      await updateMutation.mutateAsync({
        id: editingPhoto.id,
        updates: {
          title: editingPhoto.title,
          description: editingPhoto.description,
          category: editingPhoto.category,
          usage: editingPhoto.usage,
          tags: editingPhoto.tags,
        }
      });
      setIsEditDialogOpen(false);
      setEditingPhoto(null);
    } catch (error) {
      console.error('Update failed:', error);
    }
  };

  const handleSetPrimary = async (photo: Photo) => {
    try {
      await setPrimaryMutation.mutateAsync({
        id: photo.id,
        category: photo.category
      });
    } catch (error) {
      console.error('Set primary failed:', error);
    }
  };

  const handleDelete = async (photoId: string) => {
    if (confirm('Are you sure you want to delete this photo?')) {
      try {
        await deleteMutation.mutateAsync(photoId);
      } catch (error) {
        console.error('Delete failed:', error);
      }
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading photos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load photos. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">School Photos Manager</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Upload and manage photos for use across the application
          </p>
        </div>
        
        <ModernDialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <ModernDialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Upload Photos
            </Button>
          </ModernDialogTrigger>
          <ModernDialogContent size="2xl" open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
            <ModernDialogHeader>
              <ModernDialogTitle>Upload Photos</ModernDialogTitle>
            </ModernDialogHeader>
            <div className="space-y-6">
              {/* Upload Mode Toggle */}
              <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <Label className="text-sm font-medium">Upload Mode:</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={uploadMode === 'bulk' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setUploadMode('bulk')}
                  >
                    Bulk Upload
                  </Button>
                  <Button
                    type="button"
                    variant={uploadMode === 'individual' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setUploadMode('individual')}
                  >
                    Individual Settings
                  </Button>
                </div>
              </div>

              {/* File Selection */}
              <div>
                <Label htmlFor="file">Select Photos (Multiple allowed)</Label>
                <Input
                  id="file"
                  type="file"
                  accept="image/*"
                  multiple
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  You can select multiple photos at once. Supported formats: JPG, PNG, WebP
                </p>
              </div>

              {/* Selected Files Preview */}
              {selectedFiles.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">
                      Selected Photos ({selectedFiles.length})
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        selectedFiles.forEach(file => URL.revokeObjectURL(file.preview));
                        setSelectedFiles([]);
                      }}
                    >
                      Clear All
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-60 overflow-y-auto">
                    {selectedFiles.map((photoFile) => (
                      <div key={photoFile.id} className="relative group">
                        <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden border">
                          <img
                            src={photoFile.preview}
                            alt={photoFile.metadata.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              console.log('Error loading preview image:', e);
                              // Fallback to a placeholder or retry
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => removeFile(photoFile.id)}
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                        <div className="mt-1 text-xs text-center">
                          <p className="font-medium truncate">{photoFile.metadata.title}</p>
                          <p className="text-gray-500">{formatFileSize(photoFile.file.size)}</p>
                        </div>
                        {uploadProgress[photoFile.id] !== undefined && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                            <div className="text-white text-sm">
                              {uploadProgress[photoFile.id]}%
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bulk Metadata (when bulk mode is selected) */}
              {uploadMode === 'bulk' && selectedFiles.length > 0 && (
                <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">Bulk Metadata Settings</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={applyBulkMetadata}
                    >
                      Apply to All
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="bulk-description">Description</Label>
                      <Textarea
                        id="bulk-description"
                        value={bulkUploadForm.description}
                        onChange={(e) => setBulkUploadForm(prev => ({ ...prev, description: e.target.value.toUpperCase() }))}
                        placeholder="Enter description for all photos"
                        className="mt-1"
                        rows={3}
                      />
                    </div>

                    <div>
                      <Label htmlFor="bulk-category">Category</Label>
                      <Select
                        value={bulkUploadForm.category}
                        onValueChange={(value: PhotoCategory) => 
                          setBulkUploadForm(prev => ({ ...prev, category: value }))
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PHOTO_CATEGORIES.map(category => (
                            <SelectItem key={category.value} value={category.value}>
                              {category.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label>Usage (Where these photos can be used)</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mt-2">
                      {PHOTO_USAGE.map(usage => (
                        <div key={usage.value} className="flex items-center space-x-2 p-2 rounded-md border hover:bg-gray-50 dark:hover:bg-gray-800">
                          <Checkbox
                            id={`bulk-${usage.value}`}
                            checked={bulkUploadForm.usage.includes(usage.value)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setBulkUploadForm(prev => ({
                                  ...prev,
                                  usage: [...prev.usage, usage.value]
                                }));
                              } else {
                                setBulkUploadForm(prev => ({
                                  ...prev,
                                  usage: prev.usage.filter(u => u !== usage.value)
                                }));
                              }
                            }}
                          />
                          <Label htmlFor={`bulk-${usage.value}`} className="text-xs cursor-pointer">
                            {usage.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="bulk-tags">Tags (comma-separated)</Label>
                    <Input
                      id="bulk-tags"
                      value={bulkUploadForm.tags}
                      onChange={(e) => setBulkUploadForm(prev => ({ ...prev, tags: e.target.value.toUpperCase() }))}
                      placeholder="school, building, exterior"
                      className="mt-1"
                    />
                  </div>
                </div>
              )}

              {/* Individual Settings (when individual mode is selected) */}
              {uploadMode === 'individual' && selectedFiles.length > 0 && (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  <Label className="text-base font-medium">Individual Photo Settings</Label>
                  {selectedFiles.map((photoFile, index) => (
                    <div key={photoFile.id} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={photoFile.preview}
                          alt={photoFile.metadata.title}
                          className="w-16 h-16 object-cover rounded"
                        />
                        <div className="flex-1">
                          <Input
                            value={photoFile.metadata.title}
                            onChange={(e) => updateFileMetadata(photoFile.id, { title: e.target.value.toUpperCase() })}
                            placeholder="Photo title"
                            className="mb-2"
                          />
                          <Textarea
                            value={photoFile.metadata.description}
                            onChange={(e) => updateFileMetadata(photoFile.id, { description: e.target.value.toUpperCase() })}
                            placeholder="Photo description"
                            rows={2}
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <Select
                          value={photoFile.metadata.category}
                          onValueChange={(value: PhotoCategory) => 
                            updateFileMetadata(photoFile.id, { category: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PHOTO_CATEGORIES.map(category => (
                              <SelectItem key={category.value} value={category.value}>
                                {category.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`primary-${photoFile.id}`}
                            checked={photoFile.metadata.isPrimary}
                            onCheckedChange={(checked) => {
                              // Only allow one primary photo
                              if (checked) {
                                setSelectedFiles(prev => prev.map(file => ({
                                  ...file,
                                  metadata: { ...file.metadata, isPrimary: file.id === photoFile.id }
                                })));
                              } else {
                                updateFileMetadata(photoFile.id, { isPrimary: false });
                              }
                            }}
                          />
                          <Label htmlFor={`primary-${photoFile.id}`} className="text-sm">
                            Primary
                          </Label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Button */}
              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => setIsUploadDialogOpen(false)}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpload}
                  disabled={selectedFiles.length === 0 || isUploading}
                  className="w-full sm:w-auto"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading {Object.keys(uploadProgress).length} of {selectedFiles.length}...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload {selectedFiles.length} Photo{selectedFiles.length !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </ModernDialogContent>
        </ModernDialog>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search photos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <Select
          value={filterCategory}
          onValueChange={(value: PhotoCategory | 'all') => setFilterCategory(value)}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {PHOTO_CATEGORIES.map(category => (
              <SelectItem key={category.value} value={category.value}>
                {category.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex border rounded-md">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className="rounded-r-none"
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="rounded-l-none"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Photos Display */}
      {displayPhotos.length === 0 ? (
        <Card className="p-12 text-center">
          <ImageIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No photos found</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {searchTerm ? 'No photos match your search criteria.' : 'Upload your first photo to get started.'}
          </p>
          {!searchTerm && (
            <Button onClick={() => setIsUploadDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Upload Photo
            </Button>
          )}
        </Card>
      ) : (
        <div className={
          viewMode === 'grid' 
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
            : 'space-y-4'
        }>
          {displayPhotos.map((photo) => (
            <Card key={photo.id} className={viewMode === 'list' ? 'flex' : ''}>
              {viewMode === 'grid' ? (
                <>
                  <div className="relative aspect-video overflow-hidden rounded-t-lg bg-gray-100 dark:bg-gray-800">
                    <img
                      src={sanitizePhotoUrl(photo.url)}
                      alt={photo.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        console.error('Error loading photo:', photo.title, photo.url);
                        const target = e.currentTarget;
                        target.style.display = 'none';
                        const container = target.parentElement;
                        if (container && !container.querySelector('.error-placeholder')) {
                          const placeholder = document.createElement('div');
                          placeholder.className = 'error-placeholder absolute inset-0 flex items-center justify-center text-gray-500';
                          placeholder.innerHTML = '<span class="text-sm">Image not available</span>';
                          container.appendChild(placeholder);
                        }
                      }}
                    />
                    {photo.isPrimary && (
                      <Badge className="absolute top-2 left-2 bg-yellow-500">
                        <Star className="h-3 w-3 mr-1" />
                        Primary
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold truncate mb-1">{photo.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                      {photo.description}
                    </p>
                    <div className="flex flex-wrap gap-1 mb-3">
                      <Badge variant="secondary" className="text-xs">
                        {PHOTO_CATEGORIES.find(c => c.value === photo.category)?.label}
                      </Badge>
                      {photo.usage.slice(0, 2).map(usage => (
                        <Badge key={usage} variant="outline" className="text-xs">
                          {PHOTO_USAGE.find(u => u.value === usage)?.label}
                        </Badge>
                      ))}
                      {photo.usage.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{photo.usage.length - 2}
                        </Badge>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">
                        {formatFileSize(photo.fileSize)}
                      </span>
                      <div className="flex space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSetPrimary(photo)}
                          disabled={setPrimaryMutation.isPending}
                        >
                          {photo.isPrimary ? (
                            <StarOff className="h-4 w-4" />
                          ) : (
                            <Star className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(photo)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(photo.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </>
              ) : (
                <div className="flex w-full">
                  <div className="w-32 h-24 flex-shrink-0 overflow-hidden rounded-l-lg bg-gray-100 dark:bg-gray-800">
                    <img
                      src={sanitizePhotoUrl(photo.url)}
                      alt={photo.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        console.error('Error loading photo (list view):', photo.title, photo.url);
                        const target = e.currentTarget;
                        target.style.display = 'none';
                        const container = target.parentElement;
                        if (container && !container.querySelector('.error-placeholder')) {
                          const placeholder = document.createElement('div');
                          placeholder.className = 'error-placeholder absolute inset-0 flex items-center justify-center text-gray-500';
                          placeholder.innerHTML = '<span class="text-xs">Image not available</span>';
                          container.appendChild(placeholder);
                        }
                      }}
                    />
                  </div>
                  <CardContent className="flex-1 p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate">{photo.title}</h3>
                          {photo.isPrimary && (
                            <Badge className="bg-yellow-500 text-xs">
                              <Star className="h-3 w-3 mr-1" />
                              Primary
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-1">
                          {photo.description}
                        </p>
                        <div className="flex flex-wrap gap-1 mb-2">
                          <Badge variant="secondary" className="text-xs">
                            {PHOTO_CATEGORIES.find(c => c.value === photo.category)?.label}
                          </Badge>
                          {photo.usage.slice(0, 3).map(usage => (
                            <Badge key={usage} variant="outline" className="text-xs">
                              {PHOTO_USAGE.find(u => u.value === usage)?.label}
                            </Badge>
                          ))}
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatFileSize(photo.fileSize)} • {new Date(photo.uploadedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex space-x-1 ml-4">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSetPrimary(photo)}
                          disabled={setPrimaryMutation.isPending}
                        >
                          {photo.isPrimary ? (
                            <StarOff className="h-4 w-4" />
                          ) : (
                            <Star className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(photo)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(photo.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <ModernDialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <ModernDialogContent size="2xl" open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <ModernDialogHeader>
            <ModernDialogTitle>Edit Photo</ModernDialogTitle>
          </ModernDialogHeader>
          {editingPhoto && (
            <div className="space-y-6">
              <div>
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={editingPhoto.title}
                  onChange={(e) => setEditingPhoto(prev => 
                    prev ? { ...prev, title: e.target.value } : null
                  )}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editingPhoto.description || ''}
                  onChange={(e) => setEditingPhoto(prev => 
                    prev ? { ...prev, description: e.target.value } : null
                  )}
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="edit-category">Category</Label>
                <Select
                  value={editingPhoto.category}
                  onValueChange={(value: PhotoCategory) => 
                    setEditingPhoto(prev => 
                      prev ? { ...prev, category: value } : null
                    )
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PHOTO_CATEGORIES.map(category => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Usage (Select where this photo can be used)</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-3">
                  {PHOTO_USAGE.map(usage => (
                    <div key={usage.value} className="flex items-center space-x-2 p-2 rounded-md border hover:bg-gray-50 dark:hover:bg-gray-800">
                      <Checkbox
                        id={`edit-${usage.value}`}
                        checked={editingPhoto.usage.includes(usage.value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setEditingPhoto(prev => prev ? {
                              ...prev,
                              usage: [...prev.usage, usage.value]
                            } : null);
                          } else {
                            setEditingPhoto(prev => prev ? {
                              ...prev,
                              usage: prev.usage.filter(u => u !== usage.value)
                            } : null);
                          }
                        }}
                      />
                      <Label htmlFor={`edit-${usage.value}`} className="text-sm cursor-pointer">
                        {usage.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="edit-tags">Tags (comma-separated)</Label>
                <Input
                  id="edit-tags"
                  value={editingPhoto.tags?.join(', ') || ''}
                  onChange={(e) => setEditingPhoto(prev => prev ? {
                    ...prev,
                    tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
                  } : null)}
                  className="mt-1"
                />
              </div>

              <ModernDialogFooter className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
                <Button 
                  variant="outline" 
                  onClick={() => setIsEditDialogOpen(false)}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpdatePhoto}
                  disabled={updateMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update Photo'
                  )}
                </Button>
              </ModernDialogFooter>
            </div>
          )}
        </ModernDialogContent>
      </ModernDialog>
    </div>
  );
} 