"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { sanitizePhotoUrl } from "@/lib/utils/photo-url-helper";

export interface ViewablePhoto {
  id?: string;
  url: string;
  title?: string | null;
}

interface PhotoViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photos: ViewablePhoto[];
  currentIndex: number;
  onCurrentIndexChange: (index: number) => void;
}

export function PhotoViewerDialog({
  open,
  onOpenChange,
  photos,
  currentIndex,
  onCurrentIndexChange,
}: PhotoViewerDialogProps) {
  const safeIndex = photos.length > 0
    ? Math.min(Math.max(currentIndex, 0), photos.length - 1)
    : 0;
  const photo = photos[safeIndex];

  const showPrevious = () => {
    if (photos.length < 2) return;
    onCurrentIndexChange((safeIndex - 1 + photos.length) % photos.length);
  };

  const showNext = () => {
    if (photos.length < 2) return;
    onCurrentIndexChange((safeIndex + 1) % photos.length);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[calc(100vw-1rem)] max-w-6xl gap-0 overflow-hidden border-slate-700/80 bg-slate-950/95 p-2 text-white shadow-2xl sm:w-[calc(100vw-2rem)] sm:p-3"
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") showPrevious();
          if (event.key === "ArrowRight") showNext();
        }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{photo?.title || "School photo"}</DialogTitle>
          <DialogDescription>
            Enlarged school photo. Use the previous and next buttons or arrow keys to browse.
          </DialogDescription>
        </DialogHeader>

        {photo && (
          <div className="relative flex min-h-[16rem] items-center justify-center sm:min-h-[24rem]">
            <img
              src={sanitizePhotoUrl(photo.url)}
              alt={photo.title || "School photo"}
              className="max-h-[calc(100dvh-5rem)] w-full rounded-xl object-contain"
            />

            {photos.length > 1 && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={showPrevious}
                  aria-label="Show previous photo"
                  className="absolute left-2 h-10 w-10 rounded-full border border-white/20 bg-black/45 text-white shadow-lg backdrop-blur-md hover:bg-black/65 hover:text-white sm:left-4 sm:h-11 sm:w-11"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={showNext}
                  aria-label="Show next photo"
                  className="absolute right-2 h-10 w-10 rounded-full border border-white/20 bg-black/45 text-white shadow-lg backdrop-blur-md hover:bg-black/65 hover:text-white sm:right-4 sm:h-11 sm:w-11"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </>
            )}

            <div className="absolute bottom-2 left-1/2 max-w-[calc(100%-1rem)] -translate-x-1/2 rounded-full border border-white/15 bg-black/55 px-3 py-1.5 text-center text-xs text-white backdrop-blur-md sm:bottom-4 sm:text-sm">
              <span className="line-clamp-1">{photo.title || "School photo"}</span>
              {photos.length > 1 && (
                <span className="ml-2 text-white/70">{safeIndex + 1} / {photos.length}</span>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
