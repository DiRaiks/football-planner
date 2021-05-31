import React, { FC, useMemo } from 'react';
import { observer } from 'mobx-react';
import { useLocation } from 'react-router-dom';
import camelCase from 'lodash/camelCase';
import { BreadCrumbs, Crumb } from 'reusableComponents';
import { EventStore } from 'store';

import styles from './headerBreadcrumbs.module.scss';
import { TCrumb } from './types';
import names from './names.json';

const HeaderBreadcrumbs: FC = () => {
  const { pathname } = useLocation();
  const routNames: Record<string, string> = names as Record<string, string>;
  const { entity: currentEvent } = EventStore;

  const breadCrumb: TCrumb[] = useMemo(() => {
    const [, ...pathArray] = pathname.split('/');

    return pathArray.reduce((array: TCrumb[], path, index) => {
      const isIdItem = !routNames[path];
      const name = isIdItem ? 'guid' : camelCase(path);
      const namePath = array[index - 1]?.namePath ? `${array[index - 1].namePath}.${name}` : name;

      if (!path) return array;

      return [
        ...array,
        {
          path: `/${pathArray.slice(0, index + 1).join('/')}`,
          namePath,
          originName: path,
        },
      ];
    }, []);
  }, [pathname, routNames]);

  if (!breadCrumb.length) return null;

  return (
    <div className={styles.breadCrumbCont}>
      <BreadCrumbs>
        {breadCrumb.map((crumb, index) => {
          const name = routNames[crumb.namePath] ? routNames[crumb.namePath] : `Матч: ${currentEvent?.eventName || ''}`;

          if (!name) return null;

          return (
            <Crumb key={index} href={crumb.path}>
              {name}
            </Crumb>
          );
        })}
      </BreadCrumbs>
    </div>
  );
};

export default observer(HeaderBreadcrumbs);
