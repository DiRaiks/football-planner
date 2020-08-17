/* eslint-disable */
const rewireReactHotLoader = require('react-app-rewire-hot-loader');

module.exports = function override(config, env) {
  config = rewireReactHotLoader(config, env);

  if (env === 'development') {
    Object.assign(config.resolve.alias, {
      'react-dom': '@hot-loader/react-dom',
    });
  }

  return config;
};
