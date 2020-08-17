import { ReactNode, ReactElement } from 'react';

export function isReactElement(node: ReactNode): node is ReactElement {
  return (node as ReactElement)?.props !== undefined;
}
