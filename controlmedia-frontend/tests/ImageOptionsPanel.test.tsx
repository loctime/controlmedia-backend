import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ImageOptionsPanel } from '@/components/ImageOptionsPanel';
import type { ProcessOptions } from '@/types/image';

const noop = vi.fn();

function setup(value: ProcessOptions = {}, onChange = vi.fn()) {
  return render(
    <ImageOptionsPanel
      value={value}
      onChange={onChange}
      originalDimensions={{ width: 1000, height: 500 }}
    />
  );
}

describe('ImageOptionsPanel', () => {
  it('renders with defaults: quality=80, format=webp, aspect locked', () => {
    const { container } = setup();
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider.value).toBe('80');
    const select = container.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('webp');
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it('calls onChange with clamped quality when slider changes', () => {
    const onChange = vi.fn();
    const { container } = setup({}, onChange);
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '50' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ quality: 50 }));
  });

  it('recomputes height when width changes with aspect lock on', () => {
    const onChange = vi.fn();
    const { container } = setup({}, onChange);
    const inputs = container.querySelectorAll('input[type="number"]');
    const widthInput = inputs[0] as HTMLInputElement;
    fireEvent.change(widthInput, { target: { value: '400' } });
    // originalDimensions: 1000x500 => ratio 0.5, so height = 400 * 500/1000 = 200
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ width: 400, height: 200 }));
  });

  it('does NOT recompute height when width changes with aspect lock off', () => {
    const onChange = vi.fn();
    const { container } = setup({}, onChange);
    // Uncheck aspect ratio lock
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(checkbox);
    const inputs = container.querySelectorAll('input[type="number"]');
    const heightInput = inputs[1] as HTMLInputElement;
    fireEvent.change(heightInput, { target: { value: '300' } });
    const call = onChange.mock.calls[0][0] as ProcessOptions;
    expect(call.height).toBe(300);
    expect(call.width).toBeUndefined();
  });

  it('maps JPG format to "jpeg" (not "jpg")', () => {
    const onChange = vi.fn();
    const { container } = setup({}, onChange);
    const select = container.querySelector('select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'jpeg' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ format: 'jpeg' }));
  });

  it('clamps quality above 100 to 100', () => {
    const onChange = vi.fn();
    const { container } = setup({}, onChange);
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '150' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ quality: 100 }));
  });

  it('clamps quality below 1 to 1', () => {
    const onChange = vi.fn();
    const { container } = setup({}, onChange);
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '0' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ quality: 1 }));
  });
});
