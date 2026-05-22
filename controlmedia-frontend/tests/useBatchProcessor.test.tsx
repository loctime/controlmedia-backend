import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBatchProcessor } from '@/hooks/useBatchProcessor';

vi.mock('@/lib/api', () => ({
  api: {
    post: vi.fn(),
  },
}));

import { api } from '@/lib/api';
const mockPost = api.post as ReturnType<typeof vi.fn>;

const makeFile = (name: string) =>
  new File(['x'], name, { type: 'image/jpeg' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useBatchProcessor', () => {
  it('caps files at 20 when addFiles receives 25 files', () => {
    const { result } = renderHook(() => useBatchProcessor());
    const files = Array.from({ length: 25 }, (_, i) =>
      makeFile(`f${i}.jpg`)
    );

    act(() => {
      result.current.addFiles(files);
    });

    expect(result.current.batch.files).toHaveLength(20);
    expect(result.current.batch.error).toContain('Máximo 20');
  });

  it('caps at 20 when a 21st file is added after 20 already exist', () => {
    const { result } = renderHook(() => useBatchProcessor());
    const first20 = Array.from({ length: 20 }, (_, i) => makeFile(`f${i}.jpg`));
    const extra = makeFile('extra.jpg');

    act(() => {
      result.current.addFiles(first20);
    });
    act(() => {
      result.current.addFiles([extra]);
    });

    expect(result.current.batch.files).toHaveLength(20);
    expect(result.current.batch.error).toContain('Máximo 20');
  });

  it('removes a file by name via removeFile', () => {
    const { result } = renderHook(() => useBatchProcessor());
    const files = [makeFile('a.jpg'), makeFile('b.jpg'), makeFile('c.jpg')];

    act(() => {
      result.current.addFiles(files);
    });
    act(() => {
      result.current.removeFile('b.jpg');
    });

    const names = result.current.batch.files.map((f) => f.name);
    expect(names).toEqual(['a.jpg', 'c.jpg']);
  });

  it('processAll is a no-op when files is empty', () => {
    const { result } = renderHook(() => useBatchProcessor());

    act(() => {
      result.current.processAll({ quality: 80, format: 'webp' });
    });

    expect(mockPost).not.toHaveBeenCalled();
  });

  it('processAll calls api.post with /api/images/batch with N files entries and responseType blob', async () => {
    mockPost.mockResolvedValueOnce({
      data: new Blob(['zip'], { type: 'application/zip' }),
    });

    const { result } = renderHook(() => useBatchProcessor());
    const files = [makeFile('a.jpg'), makeFile('b.jpg'), makeFile('c.jpg')];

    act(() => {
      result.current.addFiles(files);
    });

    await act(async () => {
      await result.current.processAll({ quality: 80, format: 'webp' });
    });

    expect(mockPost).toHaveBeenCalledTimes(1);
    const [url, formData, config] = mockPost.mock.calls[0];
    expect(url).toBe('/api/images/batch');
    expect(config.responseType).toBe('blob');

    // Verify all 3 files are appended under 'files' key
    const filesEntries = Array.from((formData as FormData).entries()).filter(
      ([k]) => k === 'files'
    );
    expect(filesEntries).toHaveLength(3);
  });

  it('sets status complete and zipBlob on success', async () => {
    const zipBlob = new Blob(['zip'], { type: 'application/zip' });
    mockPost.mockResolvedValueOnce({ data: zipBlob });

    const { result } = renderHook(() => useBatchProcessor());

    act(() => {
      result.current.addFiles([makeFile('a.jpg')]);
    });

    await act(async () => {
      await result.current.processAll({ quality: 80, format: 'webp' });
    });

    expect(result.current.batch.status).toBe('complete');
    expect(result.current.batch.zipBlob).toBeInstanceOf(Blob);
  });

  it('sets status error and error message mentioning HEIC on 400 response', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 400 } });

    const { result } = renderHook(() => useBatchProcessor());

    act(() => {
      result.current.addFiles([makeFile('a.jpg')]);
    });

    await act(async () => {
      await result.current.processAll({ quality: 80, format: 'webp' });
    });

    expect(result.current.batch.status).toBe('error');
    expect(result.current.batch.error).toMatch(/HEIC/i);
  });

  it('enters processing phase when upload progress reaches 100%', async () => {
    let capturedUploadProgress: ((e: { progress?: number; loaded: number; total?: number }) => void) | undefined;

    mockPost.mockImplementationOnce((_url, _data, config) => {
      capturedUploadProgress = config.onUploadProgress;
      // Never resolve to keep test in processing state
      return new Promise(() => {});
    });

    const { result } = renderHook(() => useBatchProcessor());

    act(() => {
      result.current.addFiles([makeFile('a.jpg')]);
    });

    act(() => {
      result.current.processAll({ quality: 80, format: 'webp' });
    });

    // Simulate upload reaching 100%
    await act(async () => {
      capturedUploadProgress?.({ progress: 1, loaded: 100, total: 100 });
    });

    expect(result.current.batch.uploadProgress).toBe(100);
    expect(result.current.batch.status).toBe('processing');
  });
});
