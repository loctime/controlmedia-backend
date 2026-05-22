import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DropZone } from '@/components/DropZone';

function makeFile(name: string, type: string): File {
  return new File(['image-content'], name, { type });
}

// Helper: simulate a drop event with files on the dropzone
function simulateDrop(element: Element, files: File[]) {
  const dataTransfer = {
    items: files.map((file) => ({
      kind: 'file',
      type: file.type,
      getAsFile: () => file,
    })),
    files,
    types: ['Files'],
    clearData: vi.fn(),
    setData: vi.fn(),
    getData: vi.fn(),
    setDragImage: vi.fn(),
  };

  act(() => {
    // Trigger the sequence that react-dropzone listens to
    element.dispatchEvent(
      Object.assign(new Event('dragenter', { bubbles: true }), { dataTransfer })
    );
    element.dispatchEvent(
      Object.assign(new Event('dragover', { bubbles: true }), { dataTransfer })
    );
    element.dispatchEvent(
      Object.assign(new Event('drop', { bubbles: true }), { dataTransfer })
    );
  });
}

describe('DropZone — accepted formats (IMG-01)', () => {
  const acceptedFormats: Array<{ name: string; type: string }> = [
    { name: 'photo.jpg', type: 'image/jpeg' },
    { name: 'photo.png', type: 'image/png' },
    { name: 'photo.webp', type: 'image/webp' },
    { name: 'photo.avif', type: 'image/avif' },
    { name: 'photo.gif', type: 'image/gif' },
  ];

  acceptedFormats.forEach(({ name, type }) => {
    it(`accepts ${type}`, async () => {
      const onAccepted = vi.fn();
      render(<DropZone mode="single" onAccepted={onAccepted} />);

      const dropzone = screen.getByRole('button');
      const file = makeFile(name, type);

      simulateDrop(dropzone, [file]);

      await waitFor(() => {
        expect(onAccepted).toHaveBeenCalled();
        const calledFiles: File[] = onAccepted.mock.calls[0][0];
        expect(calledFiles.length).toBeGreaterThan(0);
        expect(calledFiles[0].name).toBe(name);
        expect(calledFiles[0].type).toBe(type);
      });
    });
  });
});

describe('DropZone — HEIC rejection (GEN-03)', () => {
  it('rejects a .heic file by name with exact Spanish message', async () => {
    const onAccepted = vi.fn();
    render(<DropZone mode="single" onAccepted={onAccepted} />);

    const dropzone = screen.getByRole('button');
    const file = makeFile('photo.heic', '');

    simulateDrop(dropzone, [file]);

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert.textContent).toContain(
        'Este archivo es formato HEIC/HEIF. Por favor convertí la imagen a JPG primero.'
      );
    });

    expect(onAccepted).not.toHaveBeenCalled();
  });

  it('rejects a file with type image/heic regardless of name', async () => {
    const onAccepted = vi.fn();
    render(<DropZone mode="single" onAccepted={onAccepted} />);

    const dropzone = screen.getByRole('button');
    const file = makeFile('photo.bin', 'image/heic');

    simulateDrop(dropzone, [file]);

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert.textContent).toContain(
        'Este archivo es formato HEIC/HEIF. Por favor convertí la imagen a JPG primero.'
      );
    });

    expect(onAccepted).not.toHaveBeenCalled();
  });

  it('rejects a file with type image/heif', async () => {
    const onAccepted = vi.fn();
    render(<DropZone mode="single" onAccepted={onAccepted} />);

    const dropzone = screen.getByRole('button');
    const file = makeFile('photo.bin', 'image/heif');

    simulateDrop(dropzone, [file]);

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert.textContent).toContain(
        'Este archivo es formato HEIC/HEIF. Por favor convertí la imagen a JPG primero.'
      );
    });

    expect(onAccepted).not.toHaveBeenCalled();
  });
});
