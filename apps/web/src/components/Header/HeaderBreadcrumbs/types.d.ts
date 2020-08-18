import { IIconProps } from 'ui-components';

export type TIcons = Record<string, IIconProps['type']>;

export type TCrumb = {
  displayName: string;
  path: string;
};
