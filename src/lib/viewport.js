import { useEffect } from 'react';

export function useVisualViewport() {
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const viewport = window.visualViewport;
      if (!viewport) {
        root.style.setProperty('--vvh', '100dvh');
        root.style.setProperty('--vv-top', '0px');
        return;
      }
      root.style.setProperty('--vvh', `${viewport.height}px`);
      root.style.setProperty('--vv-top', `${viewport.offsetTop}px`);
    };
    apply();
    window.visualViewport?.addEventListener('resize', apply);
    window.visualViewport?.addEventListener('scroll', apply);
    window.addEventListener('orientationchange', apply);
    return () => {
      window.visualViewport?.removeEventListener('resize', apply);
      window.visualViewport?.removeEventListener('scroll', apply);
      window.removeEventListener('orientationchange', apply);
    };
  }, []);
}
