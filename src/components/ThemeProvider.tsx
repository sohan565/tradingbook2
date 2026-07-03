'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Skip mousemove listener entirely on mobile/tablet or touch-only devices to save resources
    const isMobileDevice = window.matchMedia('(max-width: 900px)').matches || 
                           ('ontouchstart' in window) || 
                           (navigator.maxTouchPoints > 0);
    if (isMobileDevice) return;

    let frameId: number | null = null;
    let lastX = -9999;
    let lastY = -9999;
    
    const handleMouseMove = (e: MouseEvent) => {
      // Throttle movements: only update if mouse moved by at least 4 pixels
      if (Math.abs(e.clientX - lastX) < 4 && Math.abs(e.clientY - lastY) < 4) return;
      
      lastX = e.clientX;
      lastY = e.clientY;
      
      if (frameId) cancelAnimationFrame(frameId);
      
      frameId = requestAnimationFrame(() => {
        document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
        document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
        
        const normX = (e.clientX / window.innerWidth) - 0.5;
        const normY = (e.clientY / window.innerHeight) - 0.5;
        document.documentElement.style.setProperty('--parallax-x', `${normX}`);
        document.documentElement.style.setProperty('--parallax-y', `${normY}`);
      });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, []);

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
