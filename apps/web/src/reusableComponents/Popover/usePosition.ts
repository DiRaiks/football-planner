import { useEffect, useState } from 'react';
import { useWindowSize } from 'hooks';

import { TUsePosition, TPosition } from './types';

export const usePosition: TUsePosition = props => {
  const {
    anchorRef,
    anchorOriginVertical = 'bottom',
    anchorOriginHorizontal = 'left',
    anchorTransformVertical = 'top',
    anchorTransformHorizontal = 'left',
  } = props;

  const { winWidth, winHeight } = useWindowSize();
  const [position, setPosition] = useState<TPosition>(null);

  useEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();

    let top, right, bottom, left;

    const originHorizontal = anchorOriginHorizontal === 'left' ? rect.left : rect.right;
    const originVertical = anchorOriginVertical === 'top' ? rect.top : rect.bottom;

    if (anchorTransformHorizontal === 'left') left = originHorizontal;
    if (anchorTransformHorizontal === 'right') right = winWidth - originHorizontal;

    if (anchorTransformVertical === 'top') top = originVertical;
    if (anchorTransformVertical === 'bottom') bottom = winHeight - originVertical;

    setPosition({ top, right, bottom, left });
  }, [
    anchorRef,
    anchorOriginHorizontal,
    anchorOriginVertical,
    anchorTransformHorizontal,
    anchorTransformVertical,
    winWidth,
    winHeight,
  ]);

  return { position };
};
