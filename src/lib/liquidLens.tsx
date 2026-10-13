import { useId, useRef } from 'react';

/**
 * The refracting lens behind YouDO's liquid glass: an SVG filter used as a
 * `backdrop-filter`, displacing what is under a capsule toward its rim and
 * splitting the colour channels slightly there, for a faint prism.
 *
 * Android's WebView is Chromium, which takes an SVG filter in
 * `backdrop-filter`; anywhere that ignores it, the surface keeps its tint and
 * blur and simply does not bend.
 */

/**
 * A displacement map for a capsule `w`×`h`: red and green carry how far the
 * backdrop is pulled inward along the edge normal, strongest at the rim and
 * nothing past `rimDepth` — a convex lens that magnifies toward its edges.
 */
function lensMap(w: number, h: number, rimDepth: number): string {
  const canvas = document.createElement('canvas');
  const W = Math.max(2, Math.round(w));
  const H = Math.max(2, Math.round(h));
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(W, H);
  const r = H / 2;
  const hx = W / 2 - r;
  const rim = Math.max(1, Math.min(r, rimDepth));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const px = x + 0.5 - W / 2;
      const py = y + 0.5 - H / 2;
      // Capsule: distance to the segment through its middle, minus the radius.
      const cx = Math.max(-hx, Math.min(hx, px));
      const vx = px - cx;
      const vy = py;
      const len = Math.hypot(vx, vy) || 1;
      const depth = r - len;
      let dx = 0;
      let dy = 0;
      if (depth > 0 && depth < rim) {
        const t = 1 - depth / rim;
        const mag = 1 - Math.sqrt(Math.max(0, 1 - t * t));
        // Sample from further inside: the normal points out, so pull back along it.
        dx = (-vx / len) * mag;
        dy = (-vy / len) * mag;
      }
      const i = (y * W + x) * 4;
      img.data[i] = Math.round(127.5 + 127.5 * dx);
      img.data[i + 1] = Math.round(127.5 + 127.5 * dy);
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * One lens filter. Render `filter` once anywhere in the component, point the
 * glass element's `backdrop-filter` at `url(#id)`, call `setSize` when the
 * glass is measured and `setBend` each frame with how far it should bend, px.
 */
export function useLiquidLens() {
  const id = `liquid-lens-${useId().replace(/:/g, '')}`;
  const feImage = useRef<SVGFEImageElement>(null);
  const bends = useRef<(SVGFEDisplacementMapElement | null)[]>([]);
  const mapKey = useRef('');

  const setSize = (width: number, height: number, rim: number) => {
    const fe = feImage.current;
    if (!fe || width <= 0 || height <= 0) return;
    const key = `${width}x${height}@${rim}`;
    if (key === mapKey.current) return;
    mapKey.current = key;
    fe.setAttribute('width', String(width));
    fe.setAttribute('height', String(height));
    fe.setAttribute('href', lensMap(width, height, rim));
  };

  const setBend = (px: number) => {
    // Each channel bends a little less than the last: a faint prism at the rim.
    bends.current.forEach((node, i) => node?.setAttribute('scale', (px * 2 * (1 - 0.08 * i)).toFixed(2)));
  };

  const filter = (
    <svg className="liquid-lens-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feImage ref={feImage} x="0" y="0" preserveAspectRatio="none" result="map" />
        <feDisplacementMap ref={(n) => { bends.current[0] = n; }} in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G" result="bentR" />
        <feColorMatrix in="bentR" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
        <feDisplacementMap ref={(n) => { bends.current[1] = n; }} in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G" result="bentG" />
        <feColorMatrix in="bentG" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
        <feDisplacementMap ref={(n) => { bends.current[2] = n; }} in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G" result="bentB" />
        <feColorMatrix in="bentB" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
        <feBlend in="r" in2="g" mode="screen" result="rg" />
        <feBlend in="rg" in2="b" mode="screen" />
      </filter>
    </svg>
  );

  return { id, filter, setSize, setBend };
}
