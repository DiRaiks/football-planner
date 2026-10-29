import { useState } from 'react';
import { Link } from 'react-router';
import { Check, Copy } from '@phosphor-icons/react';

import { Button } from '@/components/ui';
import { usePayment } from './api';

/**
 * Where to send the money for a paid match: the organiser's details, ready to copy.
 * The organiser without details gets a pointer to the profile instead.
 */
export function PaymentDetails({
  eventId,
  isCreator,
}: {
  eventId: string;
  isCreator: boolean;
}) {
  const payment = usePayment(eventId);
  const [copied, setCopied] = useState(false);
  const details = payment.data?.details;

  if (!details) {
    return isCreator && payment.data ? (
      <p className="text-sm text-pretty text-muted">
        Чтобы игроки знали, куда переводить,{' '}
        <Link to="/account" className="text-ink underline underline-offset-2">
          добавьте реквизиты в профиле
        </Link>
        .
      </p>
    ) : null;
  }

  const copy = () =>
    navigator.clipboard
      .writeText(details)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => undefined);

  return (
    <div className="flex items-center gap-3 rounded-control bg-surface-2 py-2 pr-2 pl-3.5">
      <p className="grid min-w-0 flex-1 gap-0.5">
        <span className="text-xs text-muted">Куда переводить</span>
        <span className="break-words">{details}</span>
      </p>
      <Button
        variant="ghost"
        icon={
          copied ? (
            <Check className="size-4" weight="bold" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )
        }
        onClick={copy}
      >
        {copied ? 'Скопировано' : 'Скопировать'}
      </Button>
    </div>
  );
}
