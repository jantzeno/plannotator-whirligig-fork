import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { acquireModalIsolation, getOverlayRoot } from '../utils/overlayRoot';

interface OverlayPortalProps {
  children: React.ReactNode;
  /**
   * Modal portals temporarily remove the raw-HTML iframe from hit testing.
   * Base UI dialogs use ModalIsolationBoundary because their Portal controls
   * when descendants are mounted.
   */
  modal?: boolean;
}

export function useOverlayRoot(): HTMLElement | null {
  const [root, setRoot] = useState<HTMLElement | null>(() => getOverlayRoot());

  useEffect(() => {
    if (!root) setRoot(getOverlayRoot());
  }, [root]);

  return root;
}

export function ModalIsolationBoundary(): null {
  useEffect(() => acquireModalIsolation(), []);
  return null;
}

export function OverlayPortal({ children, modal = false }: OverlayPortalProps) {
  const root = useOverlayRoot();

  useEffect(() => {
    if (!modal) return;
    return acquireModalIsolation();
  }, [modal]);

  if (!root) return null;
  return createPortal(children, root);
}
