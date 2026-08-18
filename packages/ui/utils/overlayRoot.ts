export const OVERLAY_ROOT_ID = 'pn-overlay-root';
export const OVERLAY_ROOT_ATTRIBUTE = 'data-pn-overlay-root';
export const MODAL_OPEN_ATTRIBUTE = 'data-pn-modal-open';

const modalLeaseCounts = new WeakMap<Document, number>();

function resolveDocument(doc?: Document): Document | null {
  if (doc) return doc;
  return typeof document === 'undefined' ? null : document;
}

/**
 * Return the one application overlay root, creating it as a direct child of
 * body when necessary. Keeping portals outside the React application root
 * prevents an inert/overflow/transform state on app content from disabling or
 * clipping visible floating controls.
 */
export function getOverlayRoot(doc?: Document): HTMLElement | null {
  const targetDocument = resolveDocument(doc);
  if (!targetDocument) return null;

  const existing = targetDocument.getElementById(OVERLAY_ROOT_ID);
  if (existing) {
    existing.setAttribute(OVERLAY_ROOT_ATTRIBUTE, 'true');
    if (targetDocument.body && existing.parentElement !== targetDocument.body) {
      targetDocument.body.appendChild(existing);
    }
    return existing;
  }

  const root = targetDocument.createElement('div');
  root.id = OVERLAY_ROOT_ID;
  root.setAttribute(OVERLAY_ROOT_ATTRIBUTE, 'true');
  root.setAttribute('aria-live', 'off');
  (targetDocument.body ?? targetDocument.documentElement).appendChild(root);
  return root;
}

/**
 * Mark the top-level document as owning a modal surface. The matching theme
 * rule temporarily removes raw-HTML viewer iframes from pointer hit testing so
 * their nested browsing context cannot intercept a visible parent control.
 * Leases make nested/transitioning modals safe.
 */
export function acquireModalIsolation(doc?: Document): () => void {
  const targetDocument = resolveDocument(doc);
  if (!targetDocument) return () => {};

  const nextCount = (modalLeaseCounts.get(targetDocument) ?? 0) + 1;
  modalLeaseCounts.set(targetDocument, nextCount);
  targetDocument.documentElement.setAttribute(MODAL_OPEN_ATTRIBUTE, 'true');

  let released = false;
  return () => {
    if (released) return;
    released = true;

    const remaining = Math.max(0, (modalLeaseCounts.get(targetDocument) ?? 1) - 1);
    if (remaining === 0) {
      modalLeaseCounts.delete(targetDocument);
      targetDocument.documentElement.removeAttribute(MODAL_OPEN_ATTRIBUTE);
      return;
    }

    modalLeaseCounts.set(targetDocument, remaining);
  };
}
