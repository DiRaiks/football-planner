type TUsePasswordValidation = (
  value: string,
) => {
  ok: boolean;
  error: string | null;
};

const MIN_LENGTH = 8;

export const usePasswordValidation: TUsePasswordValidation = value => {
  if (value.length < MIN_LENGTH) {
    return { ok: false, error: `Длина должна быть не менеее ${MIN_LENGTH} символов` };
  }

  if (!value.match(/[0-9]/g)) {
    return { ok: false, error: 'oneDigit' };
  }

  if (!value.match(/[A-Z]/g)) {
    return { ok: false, error: 'oneCapital' };
  }

  // That's not my idea ¯\_(ツ)_/¯
  if (value.match(/[^0-9a-z!?.,:;-]/gi)) {
    return { ok: false, error: 'unacceptable' };
  }

  return { ok: true, error: null };
};
