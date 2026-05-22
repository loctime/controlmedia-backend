import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BeforeAfterSlider } from '@/components/BeforeAfterSlider';

vi.mock('react-compare-slider', () => ({
  ReactCompareSlider: ({ itemOne, itemTwo }: any) => (
    <div data-testid="cmp">{itemOne}{itemTwo}</div>
  ),
  ReactCompareSliderImage: ({ src, alt }: any) => (
    <img data-testid="cmp-img" src={src} alt={alt} />
  ),
}));

describe('BeforeAfterSlider', () => {
  it('renders nothing when both URLs are null', () => {
    const { container } = render(
      <BeforeAfterSlider originalUrl={null} processedUrl={null} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders both images when both URLs are provided', () => {
    const { getAllByTestId } = render(
      <BeforeAfterSlider originalUrl="blob:a" processedUrl="blob:b" />
    );
    const imgs = getAllByTestId('cmp-img');
    expect(imgs).toHaveLength(2);
    const original = imgs.find((img) => img.getAttribute('alt') === 'Original');
    const processed = imgs.find((img) => img.getAttribute('alt') === 'Procesado');
    expect(original).toBeDefined();
    expect(original?.getAttribute('src')).toBe('blob:a');
    expect(processed).toBeDefined();
    expect(processed?.getAttribute('src')).toBe('blob:b');
  });

  it('renders nothing when only originalUrl is provided', () => {
    const { container } = render(
      <BeforeAfterSlider originalUrl="blob:a" processedUrl={null} />
    );
    expect(container.firstChild).toBeNull();
  });
});
