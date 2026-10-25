import { useCallback } from 'react';

import { TUseKeyboard, TPopupMenuKeyDown, TPopupMenuMouseMove, TSelectNext, TFocusOvered } from './types';

const isFocusedNode = (node?: Element | null): boolean => {
  return !!node?.getAttribute('tabindex');
};

const getNextElement = (currentNode: Element | null, isDown: boolean): Element | null => {
  const nextElement = currentNode?.[isDown ? 'nextElementSibling' : 'previousElementSibling'];
  if (!nextElement) return null;
  if (nextElement.getAttribute('aria-disabled') || !nextElement.getAttribute('tabindex')) {
    return getNextElement(nextElement, isDown);
  }

  return nextElement;
};

export const useKeyboard: TUseKeyboard = (props, popupMenuRef) => {
  const { onKeyDown, onMouseMove, onClose } = props;

  const selectNext: TSelectNext = useCallback(
    event => {
      const menuNode = popupMenuRef.current;
      const activeNode = document.activeElement;

      const isDown = event.key === 'ArrowDown';
      const isUp = event.key === 'ArrowUp';
      const isEnter = event.key === 'Enter';

      if (!isDown && !isUp && !isEnter) return;
      if (!menuNode || !menuNode?.contains(activeNode)) return;

      event.preventDefault();

      if (isEnter) {
        if (activeNode === menuNode) {
          onClose && onClose();
        } else {
          activeNode instanceof HTMLElement && activeNode.click();
        }

        return;
      }

      let nextElement = getNextElement(activeNode, isDown);

      if (!isFocusedNode(nextElement)) {
        const items = menuNode.querySelectorAll('[tabindex]:not([aria-disabled])');
        nextElement = isDown ? items[0] : items[items.length - 1];
      }

      if (nextElement instanceof HTMLElement) {
        nextElement.focus();
      }
    },
    [onClose, popupMenuRef],
  );

  const focusOvered: TFocusOvered = useCallback(
    event => {
      const { target } = event;
      if (!(target instanceof HTMLElement)) return;

      const overed = target.closest('[tabindex]');
      const menuNode = popupMenuRef.current;

      const isContainer = overed === menuNode;
      const isOuterElement = !menuNode?.contains(overed);
      const isNoElements = !overed || !menuNode;

      if (isContainer || isNoElements || isOuterElement) return;

      if (overed instanceof HTMLElement) overed.focus();
    },
    [popupMenuRef],
  );

  const handleKeyDown: TPopupMenuKeyDown = useCallback(
    event => {
      selectNext(event);
      if (onKeyDown) onKeyDown(event);
    },
    [selectNext, onKeyDown],
  );

  const handleMouseMove: TPopupMenuMouseMove = useCallback(
    event => {
      focusOvered(event);
      if (onMouseMove) onMouseMove(event);
    },
    [focusOvered, onMouseMove],
  );

  return { handleMouseMove, handleKeyDown };
};
