import React from 'react';

/**
 * Google-style skeleton loader for pupils table
 * Shows animated shimmer effect while loading
 */
export const PupilsTableSkeleton = ({ rows = 10 }: { rows?: number }) => {
    return (
        <>
            {Array.from({ length: rows }).map((_, index) => (
                <tr key={index} className="animate-pulse">
                    <td className="px-2 sm:px-4 py-2 sm:py-3">
                        <div className="flex items-center space-x-2 sm:space-x-3">
                            {/* Avatar skeleton */}
                            <div className="h-8 w-8 sm:h-10 sm:w-10 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded-full animate-shimmer bg-[length:200%_100%]" />
                            <div className="flex-1 space-y-2">
                                {/* Name skeleton */}
                                <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded w-32 sm:w-40 animate-shimmer bg-[length:200%_100%]" />
                                {/* Details skeleton */}
                                <div className="h-3 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded w-24 sm:w-32 animate-shimmer bg-[length:200%_100%]" />
                            </div>
                        </div>
                    </td>
                    {/* Gender skeleton - hidden on mobile */}
                    <td className="hidden sm:table-cell px-2 sm:px-4 py-2 sm:py-3">
                        <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded w-16 animate-shimmer bg-[length:200%_100%]" />
                    </td>
                    {/* Age skeleton - hidden on mobile */}
                    <td className="hidden md:table-cell px-2 sm:px-4 py-2 sm:py-3">
                        <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded w-12 animate-shimmer bg-[length:200%_100%]" />
                    </td>
                    {/* Class skeleton - hidden on mobile */}
                    <td className="hidden sm:table-cell px-2 sm:px-4 py-2 sm:py-3">
                        <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded w-20 animate-shimmer bg-[length:200%_100%]" />
                    </td>
                    {/* Section skeleton - hidden on mobile */}
                    <td className="hidden lg:table-cell px-2 sm:px-4 py-2 sm:py-3">
                        <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded w-16 animate-shimmer bg-[length:200%_100%]" />
                    </td>
                    {/* Status skeleton - hidden on mobile */}
                    <td className="hidden xl:table-cell px-2 sm:px-4 py-2 sm:py-3">
                        <div className="h-6 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded-full w-16 animate-shimmer bg-[length:200%_100%]" />
                    </td>
                    {/* Actions skeleton */}
                    <td className="px-2 sm:px-4 py-2 sm:py-3">
                        <div className="flex items-center justify-end space-x-2">
                            <div className="h-8 w-8 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded animate-shimmer bg-[length:200%_100%]" />
                            <div className="h-8 w-8 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded animate-shimmer bg-[length:200%_100%]" />
                        </div>
                    </td>
                </tr>
            ))}
        </>
    );
};

// Add shimmer animation to your global CSS or tailwind config
// @keyframes shimmer {
//   0% { background-position: -200% 0; }
//   100% { background-position: 200% 0; }
// }
// .animate-shimmer {
//   animation: shimmer 2s infinite;
// }
