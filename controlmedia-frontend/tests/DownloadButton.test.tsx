import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DownloadButton } from '@/components/DownloadButton';

describe('DownloadButton — download trigger (IMG-06)', () => {
  let createObjectURLMock: ReturnType<typeof vi.fn>;
  let revokeObjectURLMock: ReturnType<typeof vi.fn>;

  beforeAll(() => {
    createObjectURLMock = vi.fn().mockReturnValue('blob:test-url');
    revokeObjectURLMock = vi.fn();

    // Assign mocks to the global URL object (jsdom provides it)
    Object.assign(globalThis.URL, {
      createObjectURL: createObjectURLMock,
      revokeObjectURL: revokeObjectURLMock,
    });

    // Prevent actual anchor navigation
    Object.defineProperty(window, 'location', {
      value: { ...window.location, assign: vi.fn() },
      writable: true,
    });
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('calls createObjectURL and revokeObjectURL exactly once when clicked', () => {
    createObjectURLMock.mockClear();
    revokeObjectURLMock.mockClear();

    const blob = new Blob(['image-content'], { type: 'image/webp' });
    render(<DownloadButton blob={blob} contentType="image/webp" />);

    const button = screen.getByRole('button', { name: /descargar/i });
    fireEvent.click(button);

    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(createObjectURLMock).toHaveBeenCalledWith(blob);
    expect(revokeObjectURLMock).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:test-url');
  });

  it('is disabled when blob is null', () => {
    render(<DownloadButton blob={null} contentType="image/webp" />);
    const button = screen.getByRole('button', { name: /descargar/i });
    expect(button).toBeDisabled();
  });
});
