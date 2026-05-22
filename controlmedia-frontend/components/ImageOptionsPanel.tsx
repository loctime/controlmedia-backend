"use client";

import { useState } from 'react';
import type { ProcessOptions } from '@/types/image';

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

type Props = {
  value: ProcessOptions;
  onChange: (next: ProcessOptions) => void;
  originalDimensions: { width: number; height: number } | null;
};

export function ImageOptionsPanel({ value, onChange, originalDimensions }: Props) {
  const [lockAspect, setLockAspect] = useState(true);

  function update(partial: Partial<ProcessOptions>) {
    onChange({ ...value, ...partial });
  }

  function handleWidthChange(raw: string) {
    const w = raw === '' ? undefined : Math.max(1, Number(raw));
    const next: ProcessOptions = { ...value, width: w };
    if (lockAspect && w !== undefined && originalDimensions) {
      next.height = Math.round((w / originalDimensions.width) * originalDimensions.height);
    }
    onChange(next);
  }

  function handleHeightChange(raw: string) {
    const h = raw === '' ? undefined : Math.max(1, Number(raw));
    const next: ProcessOptions = { ...value, height: h };
    if (lockAspect && h !== undefined && originalDimensions) {
      next.width = Math.round((h / originalDimensions.height) * originalDimensions.width);
    }
    onChange(next);
  }

  const quality = value.quality ?? 80;
  const format = value.format ?? 'webp';

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
      {/* Quality slider */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Calidad: <span className="font-semibold">{quality}</span>
        </label>
        <input
          type="range"
          min={1}
          max={100}
          value={quality}
          onChange={(e) => update({ quality: clamp(Number(e.target.value), 1, 100) })}
          className="w-full"
        />
      </div>

      {/* Width / Height inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ancho (px)
          </label>
          <input
            type="number"
            min={1}
            value={value.width ?? ''}
            onChange={(e) => handleWidthChange(e.target.value)}
            placeholder="Auto"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Alto (px)
          </label>
          <input
            type="number"
            min={1}
            value={value.height ?? ''}
            onChange={(e) => handleHeightChange(e.target.value)}
            placeholder="Auto"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Aspect ratio lock */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="lock-aspect"
          checked={lockAspect}
          onChange={(e) => setLockAspect(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600"
        />
        <label htmlFor="lock-aspect" className="text-sm text-gray-700">
          Mantener proporción
        </label>
      </div>

      {/* Format selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Formato
        </label>
        <select
          value={format}
          onChange={(e) => update({ format: e.target.value as ProcessOptions['format'] })}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="jpeg">JPG</option>
          <option value="png">PNG</option>
          <option value="webp">WebP</option>
          <option value="avif">AVIF</option>
        </select>
      </div>
    </form>
  );
}
