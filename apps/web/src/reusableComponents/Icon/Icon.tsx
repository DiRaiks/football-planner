import React, { forwardRef } from 'react';
import cn from 'classnames';

import svgContent from './iconsDefs.svg';
import { IIcon } from './types';

import styles from './icon.module.scss';

const getContainer = (): HTMLElement => {
  let container = document.getElementById('icons-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'icons-container';
    document.body.prepend(container);
  }

  return container;
};

fetch(svgContent)
  .then(response => response.text())
  .then(data => {
    const container = getContainer();
    container.style.display = 'none';
    container.innerHTML = data;
  });

const ICON_PREFIX = 'ui-icon-';

const Icon: IIcon = (props, ref) => {
  const { className, type, viewBox = '0 0 24 24', ...rest } = props;
  const isEmpty = type === 'empty';
  const classes = cn(styles.icon, className);

  return (
    <svg ref={ref} viewBox={viewBox} className={classes} {...rest}>
      {!isEmpty && <use xlinkHref={`#${ICON_PREFIX}${type}`} />}
    </svg>
  );
};

export default forwardRef(Icon);
