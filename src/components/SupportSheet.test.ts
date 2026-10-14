import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import SupportSheet from './SupportSheet';
import { SUPPORT_UPI_ID, SUPPORT_UPI_QR_URI } from '../lib/backers';
import { SUPPORT_UPI_QR } from '../lib/supportQr';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', user_metadata: { username: 'aspirant' } } }),
}));

describe('SupportSheet', () => {
  const render = () => renderToStaticMarkup(createElement(SupportSheet, { open: true, onClose: vi.fn() }));

  it('offers the UPI ID with copy and a QR code, but no in-app pay link', () => {
    const html = render();
    expect(html).toContain(SUPPORT_UPI_ID);
    expect(html).toContain('Copy');
    expect(html).toContain(`UPI QR code for ${SUPPORT_UPI_ID}`);
    // UPI apps decline personal-ID payments started from another app.
    expect(html).not.toContain('upi://pay');
    expect(html).not.toMatch(/Pay via UPI/i);
  });

  it('collects the claim for the Founding Backer badge', () => {
    const html = render();
    expect(html).toContain('Founding Backer badge');
    expect(html).toContain('UPI reference (UTR)');
    expect(html).toContain('Send for verification');
    expect(html).toContain('Credited to @aspirant');
  });

  it('renders nothing while closed', () => {
    expect(renderToStaticMarkup(createElement(SupportSheet, { open: false, onClose: vi.fn() }))).toBe('');
  });

  it('keeps the generated QR in sync with the UPI ID', () => {
    expect(SUPPORT_UPI_QR.uri).toBe(SUPPORT_UPI_QR_URI);
    expect(SUPPORT_UPI_QR_URI).toContain(`pa=${SUPPORT_UPI_ID}`);
  });
});
