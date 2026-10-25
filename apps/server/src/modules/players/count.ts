import type { PlayerEntity } from './player.model.js';

type RosterPlayer = Pick<PlayerEntity, 'status' | 'friends'> & {
  _id: { toString(): string };
  name?: string;
  userId?: string;
  sureSince?: Date | null;
  createdAt?: Date;
};

/** A person in the roster: a player, or a friend they bring */
export type RosterPerson = {
  /** Stable across changes: the player id, or the player id and the friend's position */
  key: string;
  name: string;
  /** The player who brought this friend */
  from?: string;
  /** Set for players, not for friends */
  userId?: string;
  place: 'squad' | 'maybe' | 'waiting';
};

/**
 * Who plays and who waits. Sure people (players and the friends they bring) take the
 * places in the order they became sure, so a friend added later or a late "yes" never
 * pushes out someone who committed earlier. Without `maximum` (0) everyone sure plays.
 * People are listed in sign-up order, friends after the player who brought them.
 */
export const computeRoster = (players: RosterPlayer[], maximum = 0) => {
  type Entry = Omit<RosterPerson, 'place'> & {
    sure: boolean;
    since: number;
    isPlayer: boolean;
  };
  const entries: Entry[] = [];

  players.forEach((player, index) => {
    // Sign-ups saved before `sureSince` existed queue by their sign-up time
    const base = player.createdAt?.getTime() ?? index;
    const id = player._id.toString();
    const name = player.name ?? '';
    entries.push({
      key: id,
      name,
      ...(player.userId && { userId: player.userId }),
      isPlayer: true,
      sure: player.status,
      since: player.sureSince?.getTime() ?? base,
    });
    player.friends.forEach((friend, position) =>
      entries.push({
        key: `${id}:${position}`,
        name: friend.name,
        from: name,
        isPlayer: false,
        sure: friend.status,
        since: friend.sureSince?.getTime() ?? base,
      }),
    );
  });

  const queue = entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.sure)
    .sort((a, b) => a.entry.since - b.entry.since || a.index - b.index);
  const squad = new Set(
    (maximum > 0 ? queue.slice(0, maximum) : queue).map(({ index }) => index),
  );

  const people: RosterPerson[] = entries.map(
    ({ key, name, from, userId, sure }, index) => ({
      key,
      name,
      ...(from !== undefined && { from }),
      ...(userId !== undefined && { userId }),
      place: !sure ? 'maybe' : squad.has(index) ? 'squad' : 'waiting',
    }),
  );
  const count = { all: 0, exactly: 0, maybe: 0, waiting: 0 };
  for (const person of people) {
    count.all++;
    if (person.place === 'squad') count.exactly++;
    else if (person.place === 'maybe') count.maybe++;
    else count.waiting++;
  }
  const waitlisted = new Set(
    people
      .filter(
        (person, index) =>
          entries[index]!.isPlayer && person.place === 'waiting',
      )
      .map((person) => person.key),
  );

  return { count, waitlisted, people };
};

/** Who got a place and who lost one between two rosters of the same match */
export const squadChanges = (before: RosterPerson[], after: RosterPerson[]) => {
  const was = new Map(before.map((person) => [person.key, person.place]));
  return {
    promoted: after.filter(
      (person) => person.place === 'squad' && was.get(person.key) === 'waiting',
    ),
    demoted: after.filter(
      (person) => person.place === 'waiting' && was.get(person.key) === 'squad',
    ),
  };
};

/** Counts players including their friends, without a limit of places */
export const countPlayers = (
  players: Pick<PlayerEntity, 'status' | 'friends'>[],
) =>
  computeRoster(
    players.map((player, i) => ({ ...player, _id: String(i) })),
    0,
  ).count;
