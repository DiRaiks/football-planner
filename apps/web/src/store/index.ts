import 'mobx-react-lite/batchingForReactDom';
import { configure } from 'mobx';

configure({ enforceActions: 'always' });

// constructors
export { default as Action } from './action';
export { default as EntityStore } from './entity';
export { default as EntitiesStore } from './entities';

export * from './action';
export * from './entity';
export * from './entities';

// stores
export { default as UserStore } from './user';
export { default as ErrorsStore } from './errors';
export { default as AlertsStore } from './alerts';
export { default as EventsStore } from './events';
export { default as PlayersStore } from './players';

export * from './user';
export * from './errors';
export * from './alerts';
export * from './events';
export * from './players';
