"use client";

import { useState } from 'react';
import { SingleImageTool } from '@/components/SingleImageTool';
import { BatchImageTool } from '@/components/BatchImageTool';

type Mode = 'single' | 'batch';

export default function ImageToolPage() {
  const [mode, setMode] = useState<Mode>('single');

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Optimizar imágenes</h1>

      {/* Mode toggle */}
      <div className="flex gap-1 mb-6 p-1 bg-gray-100 rounded-lg w-fit">
        <button
          onClick={() => setMode('single')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === 'single'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          type="button"
        >
          Una imagen
        </button>
        <button
          onClick={() => setMode('batch')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === 'batch'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          type="button"
        >
          Varias imágenes
        </button>
      </div>

      {/* Tool panels */}
      {mode === 'single' ? <SingleImageTool /> : <BatchImageTool />}
    </main>
  );
}
