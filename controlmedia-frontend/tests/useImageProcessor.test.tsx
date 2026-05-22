import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useImageProcessor } from '@/hooks/useImageProcessor';

// Mock the api module
vi.mock('@/lib/api', () => ({
  api: {
    post: vi.fn(),
  },
}));

// Import api after mocking
import { api } from '@/lib/api';
const mockPost = api.post as ReturnType<typeof vi.fn>;

const makeFile = () => new File(['dummy content'], 'test.jpg', { type: 'image/jpeg' });

beforeEach(() => {
  vi.clearAllMocks();
  // Mock URL methods
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
  });
  // Suppress Image dimension probing in tests
  vi.stubGlobal('Image', class {
    naturalWidth = 0;
    naturalHeight = 0;
    onload: (() => void) | null = null;
    set src(_: string) {
      // trigger onload asynchronously to avoid affecting test assertions
    }
  });
});

describe('useImageProcessor', () => {
  it('Test 1: FormData includes quality, format, width but NOT height when not set', async () => {
    mockPost.mockResolvedValueOnce({
      data: new Blob(['img'], { type: 'image/jpeg' }),
      headers: {
        'content-type': 'image/jpeg',
        'x-original-size': '2000',
        'x-result-size': '500',
        'x-reduction-pct': '75',
      },
    });

    const { result } = renderHook(() => useImageProcessor());

    await act(async () => {
      await result.current.process(makeFile(), { quality: 50, format: 'jpeg', width: 800 });
    });

    expect(mockPost).toHaveBeenCalledTimes(1);
    const [url, formData, config] = mockPost.mock.calls[0];
    expect(url).toBe('/api/images/process');
    expect(config.responseType).toBe('blob');

    const entries = Object.fromEntries((formData as FormData).entries());
    expect(entries['quality']).toBe('50');
    expect(entries['format']).toBe('jpeg');
    expect(entries['width']).toBe('800');
    expect(entries['height']).toBeUndefined();
    expect(entries['file']).toBeDefined();
  });

  it('Test 2: after process(), job fields populated from lowercase X-* headers', async () => {
    mockPost.mockResolvedValueOnce({
      data: new Blob(['img'], { type: 'image/webp' }),
      headers: {
        'content-type': 'image/webp',
        'x-original-size': '1000',
        'x-result-size': '300',
        'x-reduction-pct': '70',
      },
    });

    const { result } = renderHook(() => useImageProcessor());

    await act(async () => {
      await result.current.process(makeFile(), {});
    });

    expect(result.current.job?.status).toBe('complete');
    expect(result.current.job?.originalSize).toBe(1000);
    expect(result.current.job?.resultSize).toBe(300);
    expect(result.current.job?.reductionPct).toBe(70);
    expect(result.current.job?.contentType).toBe('image/webp');
  });

  it('Test 3: reprocess() reuses originalFile and re-runs POST with new options', async () => {
    const successResponse = {
      data: new Blob(['img'], { type: 'image/avif' }),
      headers: {
        'content-type': 'image/avif',
        'x-original-size': '1000',
        'x-result-size': '200',
        'x-reduction-pct': '80',
      },
    };
    mockPost.mockResolvedValue(successResponse);

    const file = makeFile();
    const { result } = renderHook(() => useImageProcessor());

    // First process
    await act(async () => {
      await result.current.process(file, { quality: 80, format: 'webp' });
    });

    expect(mockPost).toHaveBeenCalledTimes(1);

    // Reprocess with new options
    await act(async () => {
      await result.current.reprocess({ quality: 90, format: 'avif' });
    });

    expect(mockPost).toHaveBeenCalledTimes(2);
    const [, formData2] = mockPost.mock.calls[1];
    const entries2 = Object.fromEntries((formData2 as FormData).entries());
    expect(entries2['format']).toBe('avif');
    expect(entries2['quality']).toBe('90');
    // Same file as the original
    expect(entries2['file']).toBe(file);
  });

  it('Test 4: NaN header value produces null in job fields (not NaN)', async () => {
    mockPost.mockResolvedValueOnce({
      data: new Blob(['img'], { type: 'image/webp' }),
      headers: {
        'content-type': 'image/webp',
        'x-original-size': 'oops',
        'x-result-size': '300',
        'x-reduction-pct': '70',
      },
    });

    const { result } = renderHook(() => useImageProcessor());

    await act(async () => {
      await result.current.process(makeFile(), {});
    });

    expect(result.current.job?.originalSize).toBeNull();
    expect(result.current.job?.resultSize).toBe(300);
  });
});
