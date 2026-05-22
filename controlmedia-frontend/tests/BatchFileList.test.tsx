import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { BatchFileList } from '@/components/BatchFileList';

const makeFile = (name: string, size: number) => {
  const file = new File(['x'.repeat(size)], name, { type: 'image/jpeg' });
  return file;
};

describe('BatchFileList', () => {
  it('renders nothing when files array is empty', () => {
    const { container } = render(
      <BatchFileList files={[]} onRemove={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders 3 list items and summary when 3 files provided', () => {
    const files = [
      makeFile('a.jpg', 1024),
      makeFile('b.jpg', 2048),
      makeFile('c.jpg', 4096),
    ];
    render(<BatchFileList files={files} onRemove={vi.fn()} />);

    expect(screen.getByText(/3 archivos seleccionados/)).toBeInTheDocument();
    // 1024+2048+4096 = 7168 bytes = 7.0 KB
    expect(screen.getByText(/7\.0 KB/)).toBeInTheDocument();
    // 3 list items
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('calls onRemove with the file name when Quitar is clicked', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const files = [makeFile('test.jpg', 500)];
    render(<BatchFileList files={files} onRemove={onRemove} />);

    await user.click(screen.getByRole('button', { name: /quitar/i }));
    expect(onRemove).toHaveBeenCalledWith('test.jpg');
  });
});
