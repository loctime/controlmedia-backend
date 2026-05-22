"use client";

import { formatBytes } from '@/lib/format';

type Props = {
  original: number | null;
  result: number | null;
  pct: number | null;
};

export function SizeReadout({ original, result, pct }: Props) {
  if (
    original == null ||
    result == null ||
    pct == null ||
    Number.isNaN(original) ||
    Number.isNaN(result) ||
    Number.isNaN(pct)
  ) {
    return null;
  }

  return (
    <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm space-y-1">
      <p className="text-gray-700">
        Tamaño original: <span className="font-medium">{formatBytes(original)}</span>
      </p>
      <p className="text-gray-700">
        Tamaño resultado: <span className="font-medium">{formatBytes(result)}</span>
      </p>
      <p className="text-gray-700">
        % reducción:{' '}
        <span className="font-semibold text-green-600">{pct}%</span>
      </p>
    </div>
  );
}
