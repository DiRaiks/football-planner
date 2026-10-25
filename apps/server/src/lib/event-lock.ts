const locks = new Map<string, Promise<unknown>>();

/**
 * Runs changes to one match's roster one after another, so "who moved into the squad"
 * is computed against the state right before each change and announced once. The
 * service runs as a single instance (see deploy/README.md).
 */
export const withEventLock = <T>(eventId: string, task: () => Promise<T>) => {
  const previous = locks.get(eventId) ?? Promise.resolve();
  const run = previous.then(task, task);
  const settled = run.catch(() => undefined);
  locks.set(eventId, settled);
  void settled.then(() => {
    if (locks.get(eventId) === settled) locks.delete(eventId);
  });
  return run;
};
