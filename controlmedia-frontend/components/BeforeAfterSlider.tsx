"use client";

import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider';

interface BeforeAfterSliderProps {
  originalUrl: string | null;
  processedUrl: string | null;
}

export function BeforeAfterSlider({ originalUrl, processedUrl }: BeforeAfterSliderProps) {
  if (!originalUrl || !processedUrl) return null;

  return (
    <div className="w-full max-h-[600px] overflow-hidden rounded-lg border border-gray-200">
      <ReactCompareSlider
        defaultPosition={50}
        itemOne={
          <ReactCompareSliderImage
            src={originalUrl}
            alt="Original"
            style={{ objectFit: 'contain', height: '100%', width: '100%' }}
          />
        }
        itemTwo={
          <ReactCompareSliderImage
            src={processedUrl}
            alt="Procesado"
            style={{ objectFit: 'contain', height: '100%', width: '100%' }}
          />
        }
      />
    </div>
  );
}
