import { useEffect } from 'react';

/**
 * Custom hook to lock body scrolling when a modal, drawer, or dialog is active.
 * Prevents background content scrolling on iOS and Android touch devices.
 *
 * @param {boolean} isLocked - Whether scroll lock should be active
 */
export const useBodyScrollLock = (isLocked) => {
  useEffect(() => {
    if (!isLocked || typeof document === 'undefined') return;

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;

    // Prevent content layout shift from scrollbar disappearance on desktop
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }

    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [isLocked]);
};

export default useBodyScrollLock;
