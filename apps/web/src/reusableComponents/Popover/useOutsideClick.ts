import { useEffect, useCallback } from 'react';

import { TUseOutsideClick, TPopoverOutsideClick } from './types';

export const useOutsideClick: TUseOutsideClick = (props, popoverRef) => {
  const { onClose } = props;

  const handleOutsideClick: TPopoverOutsideClick = useCallback(
    event => {
      const wrapper = popoverRef.current;
      const { target } = event;

      if (target instanceof Element) {
        const isInnerClick = wrapper && target && wrapper.contains(target);
        const isUnMounted = target && !document.body.contains(target);

        if (isInnerClick || isUnMounted) return;
      }

      if (onClose) onClose();
    },
    [onClose, popoverRef],
  );

  useEffect(() => {
    document.addEventListener('click', handleOutsideClick);

    return (): void => document.removeEventListener('click', handleOutsideClick);
  }, [handleOutsideClick]);
};
