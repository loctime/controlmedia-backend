"use client";

import { useEffect } from 'react';

export default function BackendWarmup() {
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/health`).catch(() => {});
  }, []);

  return null;
}
