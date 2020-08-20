import { useCallback, useState, useEffect } from 'react';

export interface IWindowSize {
  winWidth: number;
  winHeight: number;
}

export const getWindowSize = (): IWindowSize => {
  const winWidth = window.innerWidth;
  const winHeight = window.innerHeight;

  return { winWidth, winHeight };
};

export const useWindowSize = (): IWindowSize => {
  const [size, setSize] = useState(getWindowSize);

  const handleResize = useCallback(() => {
    setSize(getWindowSize());
  }, []);

  useEffect(() => {
    window.addEventListener('resize', handleResize);

    return (): void => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  return size;
};
