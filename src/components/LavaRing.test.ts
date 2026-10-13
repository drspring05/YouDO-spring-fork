import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import LavaRing from './LavaRing';

const render = (progress: number) => renderToStaticMarkup(createElement(LavaRing, { progress }));

describe('LavaRing', () => {
  it('shows only the track before any progress', () => {
    const html = render(0);
    expect(html).toContain('lava-ring-track');
    expect(html).not.toContain('lava-ring-flow');
  });

  it('flows along the filled part with rounded ends while in progress', () => {
    const html = render(42);
    expect(html).toContain('--p:0.42');
    expect(html).toContain('lava-ring-flow');
    expect(html.match(/lava-ring-cap/g)).toHaveLength(2);
  });

  it('is a seamless glowing circle when the day is done', () => {
    const html = render(100);
    expect(html).toContain('lava-ring-flow');
    expect(html).not.toContain('lava-ring-cap');
  });

  it('clamps bad input', () => {
    expect(render(250)).toContain('data-progress="100"');
    expect(render(Number.NaN)).toContain('data-progress="0"');
  });
});
