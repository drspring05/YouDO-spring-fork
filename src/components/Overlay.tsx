import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import { registerOverlayCloser } from '../lib/overlayNavigation';

type Align = 'center' | 'bottom' | 'full';
const layers: HTMLDivElement[] = [];
let unlockedOverflow = '';

interface OverlayProps {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  align?: Align;
  scrim?: boolean;
  /**
   * Width of a full-screen page on large screens: the app's content column
   * (default), a wider column for editors, or edge to edge.
   */
  fullWidth?: 'column' | 'wide' | 'bleed';
}

function overlayHost(): HTMLElement {
  return document.getElementById('overlay-root') ?? document.body;
}

export default function Overlay({
  open,
  onClose,
  children,
  align = 'center',
  scrim = true,
  fullWidth = 'column',
}: OverlayProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useLayoutEffect(() => {
    if (!open) return;
    const layer = layerRef.current;
    if (!layer) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!layers.length) unlockedOverflow = document.body.style.overflow;
    layers.push(layer);
    const unregisterClose = registerOverlayCloser(() => closeRef.current?.());
    layer.style.zIndex = String(1000 + layers.length);
    document.body.style.overflow = 'hidden';
    if (!layer.contains(document.activeElement)) layer.focus({ preventScroll: true });
    // On the Android app the system already resizes the window for the keyboard, and the layer is
    // fixed to that window. Sizing it again from visualViewport left the sheet hidden behind the
    // keyboard (black screen), so this only runs in a normal browser.
    const trackViewport = !Capacitor.isNativePlatform() && Boolean(window.visualViewport);
    const onViewport = () => {
      if (window.visualViewport) {
        layer.style.height = `${window.visualViewport.height}px`;
        layer.style.top = `${window.visualViewport.offsetTop}px`;
      }
    };
    if (trackViewport && window.visualViewport) {
      onViewport();
      window.visualViewport.addEventListener('resize', onViewport);
      window.visualViewport.addEventListener('scroll', onViewport);
    }

    const onKey = (e: KeyboardEvent) => {
      if (layers[layers.length - 1] !== layer) return;
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopImmediatePropagation(); closeRef.current?.();
      }
      if (e.key === 'Tab') {
        const focusable = Array.from(layer.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], summary, [tabindex="0"]'))
          .filter((element) => element.getClientRects().length && !element.closest('[hidden], [inert]'));
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first) { e.preventDefault(); layer.focus(); }
        else if (e.shiftKey && (document.activeElement === first || document.activeElement === layer)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || document.activeElement === layer)) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', onViewport);
        window.visualViewport.removeEventListener('scroll', onViewport);
      }
      const wasTop = layers[layers.length - 1] === layer;
      unregisterClose();
      const index = layers.indexOf(layer);
      if (index >= 0) layers.splice(index, 1);
      if (!layers.length) document.body.style.overflow = unlockedOverflow;
      window.removeEventListener('keydown', onKey);
      if (wasTop && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [open]);

  // Chromium often skips backdrop-filter on the first portal paint until a later
  // compositor update (e.g. a button re-render). Re-apply the filter on the next frame.
  useLayoutEffect(() => {
    if (!open || !scrim) return;
    const el = layerRef.current;
    if (!el) return;
    el.style.setProperty('backdrop-filter', 'none');
    el.style.setProperty('-webkit-backdrop-filter', 'none');
    const id = requestAnimationFrame(() => {
      el.style.removeProperty('backdrop-filter');
      el.style.removeProperty('-webkit-backdrop-filter');
    });
    return () => cancelAnimationFrame(id);
  }, [open, scrim]);

  if (!open) return null;

  // `no-swipe`: dragging inside a sheet or dialog must never be read as the tab-to-tab swipe.
  const rootClass = [
    'overlay-layer',
    'no-swipe',
    align === 'bottom' ? 'overlay-layer-bottom' : align === 'full' ? 'overlay-layer-full' : 'overlay-layer-center',
    scrim ? 'overlay-layer-scrim' : '',
    align === 'full' && fullWidth !== 'column' ? `overlay-full-${fullWidth}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (typeof document === 'undefined') {
    return (
      <div className={rootClass} role="dialog" aria-modal="true" tabIndex={-1}>
        <div className="overlay-content">
          {children}
        </div>
      </div>
    );
  }

  return createPortal(
    <div
      ref={layerRef}
      className={rootClass}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      onClick={scrim ? onClose : undefined}
    >
      <div className="overlay-content" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    overlayHost(),
  );
}
