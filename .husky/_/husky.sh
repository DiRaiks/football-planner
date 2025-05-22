#!/usr/bin/env sh
if [ -z "$husky_skip_init" ]; then
  debug() {
    [ -n "$HUSKY_DEBUG" ] && echo "husky (debug) - $1"
  }
  readonly hook_name="$(basename "$0")"
  debug "starting $hook_name..."
  if [ "$HUSKY" = "0" ]; then
    debug "HUSKY env variable is set to 0, skipping hook"
    exit 0
  fi
  if [ -f ~/.huskyrc ]; then
    debug "~/.huskyrc is deprecated, please migrate to ~/.huskyrc"
    . ~/.huskyrc
  fi
  export husky_skip_init=1
  PATH="$(dirname "$0")/../../node_modules/.bin:$PATH"
  export PATH
  sh -e "$0" "$@" || exit $?
fi
