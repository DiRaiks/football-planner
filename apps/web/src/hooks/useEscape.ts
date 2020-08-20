import { useCallback } from 'react';

type TKeyDownHandle = (event: React.KeyboardEvent<HTMLDivElement>) => void;

interface IUseEscapeProps {
  onClose?: () => void;
  onKeyDown?: TKeyDownHandle;
}

type TUseEscape = (
  props: IUseEscapeProps,
) => {
  handleKeyDown: TKeyDownHandle;
};

export const useEscape: TUseEscape = props => {
  const { onClose, onKeyDown } = props;

  const handleKeyDown: TKeyDownHandle = useCallback(
    event => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        if (onClose) onClose();
      }

      if (onKeyDown) onKeyDown(event);
    },
    [onClose, onKeyDown],
  );

  return { handleKeyDown };
};
