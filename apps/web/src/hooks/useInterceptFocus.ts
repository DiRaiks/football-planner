import { useEffect, useRef, MutableRefObject } from 'react';

export type TUseInterceptFocus = (ref: MutableRefObject<HTMLElement | null>) => void;

export const useInterceptFocus: TUseInterceptFocus = elementRef => {
  const initialElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) {
        initialElement.current = document.activeElement;
      }

      elementRef.current?.focus();
    });

    return (): void => {
      initialElement.current?.focus();
    };
  }, [elementRef]);
};
