import 'mobx-react-lite/batchingForReactDom';
import { configure } from 'mobx';

configure({ enforceActions: 'always' });

// constructors

// stores
export { default as UserStore } from './user';
export { default as ErrorsStore } from './errors';
export { default as AlertsStore } from './alerts';

export * from './user';
export * from './errors';
export * from './alerts';
