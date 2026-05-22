import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SizeReadout } from '@/components/SizeReadout';

describe('SizeReadout', () => {
  it('renders nothing when all values are null', () => {
    const { container } = render(
      <SizeReadout original={null} result={null} pct={null} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders all three values when provided', () => {
    const { getByText } = render(
      <SizeReadout original={1024 * 100} result={1024 * 30} pct={70} />
    );
    expect(getByText(/100\.0 KB/)).toBeTruthy();
    expect(getByText(/30\.0 KB/)).toBeTruthy();
    expect(getByText(/70%/)).toBeTruthy();
  });

  it('renders nothing when original is NaN', () => {
    const { container } = render(
      <SizeReadout original={NaN} result={123} pct={5} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders sub-KB values without decimal (500 B, 250 B)', () => {
    const { getByText } = render(
      <SizeReadout original={500} result={250} pct={50} />
    );
    expect(getByText(/500 B/)).toBeTruthy();
    expect(getByText(/250 B/)).toBeTruthy();
  });
});
