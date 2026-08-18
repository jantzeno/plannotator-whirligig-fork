import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  MODAL_OPEN_ATTRIBUTE,
  OVERLAY_ROOT_ATTRIBUTE,
  OVERLAY_ROOT_ID,
  acquireModalIsolation,
  getOverlayRoot,
} from '../utils/overlayRoot';
import { OverlayPortal } from './OverlayPortal';

const hasDom = typeof document !== 'undefined';

let reactRoot: Root | null = null;
let appHost: HTMLElement | null = null;

async function mount(ui: React.ReactElement): Promise<void> {
  appHost = document.createElement('div');
  appHost.id = 'root';
  appHost.setAttribute('inert', '');
  document.body.appendChild(appHost);
  reactRoot = createRoot(appHost);
  await act(async () => reactRoot?.render(ui));
}

afterEach(async () => {
  if (reactRoot) await act(async () => reactRoot?.unmount());
  reactRoot = null;
  appHost = null;
  if (hasDom) {
    document.documentElement.removeAttribute(MODAL_OPEN_ATTRIBUTE);
    document.body.replaceChildren();
  }
});

describe('overlay layer contract', () => {
  test('defines one ordered layer scale and iframe modal isolation rule', () => {
    const theme = readFileSync(resolve(import.meta.dir, '../theme.css'), 'utf8');

    expect(theme).toContain('--pn-layer-content: 0');
    expect(theme).toContain('--pn-layer-modal: 40');
    expect(theme).toContain('--pn-layer-popover: 50');
    expect(theme).toContain('--pn-layer-overlay-root: 2000');
    expect(theme).toContain('position: fixed');
    expect(theme).toContain('pointer-events: none');
    expect(theme).toContain(":where(#pn-overlay-root[data-pn-overlay-root='true'] > *)");
    expect(theme).toContain("html[data-pn-modal-open='true'] iframe[data-pn-html-viewer='true']");
    expect(theme).toContain('pointer-events: none !important');
  });

  test.skipIf(!hasDom)('reuses and reparents the overlay root outside inert application content', () => {
    const inertHost = document.createElement('main');
    inertHost.setAttribute('inert', '');
    const misplacedRoot = document.createElement('div');
    misplacedRoot.id = OVERLAY_ROOT_ID;
    inertHost.appendChild(misplacedRoot);
    document.body.appendChild(inertHost);

    const first = getOverlayRoot();
    const second = getOverlayRoot();

    expect(first).toBe(misplacedRoot);
    expect(second).toBe(first);
    expect(first?.parentElement).toBe(document.body);
    expect(first?.getAttribute(OVERLAY_ROOT_ATTRIBUTE)).toBe('true');
    expect(document.querySelectorAll(`#${OVERLAY_ROOT_ID}`)).toHaveLength(1);
  });

  test.skipIf(!hasDom)('keeps modal isolation active until the final lease releases', () => {
    const releaseFirst = acquireModalIsolation();
    const releaseSecond = acquireModalIsolation();

    expect(document.documentElement.getAttribute(MODAL_OPEN_ATTRIBUTE)).toBe('true');
    releaseFirst();
    expect(document.documentElement.getAttribute(MODAL_OPEN_ATTRIBUTE)).toBe('true');
    releaseFirst();
    expect(document.documentElement.getAttribute(MODAL_OPEN_ATTRIBUTE)).toBe('true');
    releaseSecond();
    expect(document.documentElement.hasAttribute(MODAL_OPEN_ATTRIBUTE)).toBe(false);
  });

  test.skipIf(!hasDom)('renders interactive portal content outside an inert app host', async () => {
    let clicks = 0;
    await mount(
      <OverlayPortal>
        <button type="button" onClick={() => clicks++}>Overlay action</button>
      </OverlayPortal>,
    );

    const overlayRoot = document.getElementById(OVERLAY_ROOT_ID);
    const button = overlayRoot?.querySelector<HTMLButtonElement>('button');

    expect(overlayRoot?.parentElement).toBe(document.body);
    expect(appHost?.contains(button ?? null)).toBe(false);
    button?.click();
    expect(clicks).toBe(1);
  });

  test.skipIf(!hasDom)('acquires and releases iframe isolation with a modal portal', async () => {
    await mount(
      <OverlayPortal modal>
        <div role="dialog">Modal content</div>
      </OverlayPortal>,
    );

    expect(document.documentElement.getAttribute(MODAL_OPEN_ATTRIBUTE)).toBe('true');
    await act(async () => reactRoot?.unmount());
    reactRoot = null;
    expect(document.documentElement.hasAttribute(MODAL_OPEN_ATTRIBUTE)).toBe(false);
  });
});
