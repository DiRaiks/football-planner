type TUsePasswordEquals = (
  first: string,
  second: string,
) => {
  ok: boolean;
  error: string | null;
};

export const usePasswordEquals: TUsePasswordEquals = (first, second) => {
  if (first !== second) {
    return { ok: false, error: 'equals' };
  }

  return { ok: true, error: null };
};
