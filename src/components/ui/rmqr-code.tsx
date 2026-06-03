"use client";

import React, { useEffect, useRef } from 'react';
import QRCodeStyling, { DotType, CornerSquareType, CornerDotType } from 'qr-code-styling';

interface RMQRCodeProps {
  data: string;
  pixelSize?: number; // This will influence the overall size calculation
  className?: string;
}

export const RMQRCode: React.FC<RMQRCodeProps> = ({ 
  data,
  pixelSize = 4, // Base size factor
  className = ""
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const qrCode = useRef<QRCodeStyling | null>(null); 

  const size = pixelSize * 50; // Adjust this multiplier as needed for appropriate QR code size
  const verticalScale = 0.3;
  const excessLayoutHeight = size * (1 - verticalScale);

  useEffect(() => {
    if (ref.current) {
      qrCode.current = new QRCodeStyling({
        width: size,
        height: size, // We'll use CSS transform to make it rectangular
        data: data || "", // Ensure data is always a string
        margin: 5,
        image: "", // No image for now
        dotsOptions: {
          color: "#000000",
          type: "dots" as DotType, // Use 'dots' for circular modules, or 'rounded'
        },
        cornersSquareOptions: {
          color: "#000000",
          type: "dot" as CornerSquareType, // Optional: style for corner squares
        },
        cornersDotOptions: {
          color: "#000000",
          type: "dot" as CornerDotType, // Optional: style for corner dots
        },
        backgroundOptions: {
          color: "#ffffff", // Or use 'transparent'
        },
        qrOptions: {
          errorCorrectionLevel: "M",
        }
      });
      qrCode.current.append(ref.current);
    }

    // Cleanup on component unmount
    return () => {
      if (ref.current) {
        ref.current.innerHTML = "";
      }
    };
  }, [data, size]);

  useEffect(() => {
    if (qrCode.current) {
      qrCode.current.update({
        width: size,
        height: size,
        data: data || "",
        dotsOptions: {
          color: "#000000",
          type: "dots" as DotType,
        },
        cornersSquareOptions: {
            color: "#000000",
            type: "dot" as CornerSquareType,
        },
        cornersDotOptions: {
            color: "#000000",
            type: "dot" as CornerDotType,
        },
      });
    }
  }, [data, size]);

  return (
    <div className={`rmqr-container ${className}`}>
      <div style={{ 
        transform: `scale(1.3, ${verticalScale})`,
        transformOrigin: 'top',
        display: 'inline-block',
        width: size, 
        height: size,
        marginBottom: `-${excessLayoutHeight}px` // Add negative margin to pull content up
      }}>
        <div ref={ref} />
      </div>
    </div>
  );
}; 