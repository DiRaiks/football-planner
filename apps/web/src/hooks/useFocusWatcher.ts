type TSubscriber = (() => void) | null;

let subscriber: TSubscriber = () => {
  const tabCode = 9;

  document.body.addEventListener('mousedown', () => {
    document.body.removeAttribute('data-using-keyboard');
  });

  document.body.addEventListener('keydown', event => {
    if (event.keyCode === tabCode) {
      document.body.setAttribute('data-using-keyboard', '');
    }
  });

  subscriber = null;
};

export const useFocusWatcher = (): void => {
  if (subscriber) subscriber();
};
