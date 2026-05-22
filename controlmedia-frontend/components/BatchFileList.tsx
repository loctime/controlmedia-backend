"use client";

import { formatBytes } from '@/lib/format';

interface BatchFileListProps {
  files: File[];
  onRemove: (name: string) => void;
}

export function BatchFileList({ files, onRemove }: BatchFileListProps) {
  if (files.length === 0) return null;

  const total = files.reduce((s, f) => s + f.size, 0);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <p className="px-4 py-2 text-sm text-gray-600 bg-gray-50 border-b border-gray-200">
        {files.length} archivos seleccionados — {formatBytes(total)}
      </p>
      <ul className="divide-y divide-gray-100">
        {files.map((file) => (
          <li
            key={file.name}
            className="flex items-center justify-between px-4 py-2 text-sm"
          >
            <span className="truncate text-gray-800 flex-1 mr-3">{file.name}</span>
            <span className="text-gray-500 mr-3 whitespace-nowrap">{formatBytes(file.size)}</span>
            <button
              onClick={() => onRemove(file.name)}
              className="text-red-600 hover:text-red-800 transition-colors whitespace-nowrap"
              type="button"
            >
              Quitar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
