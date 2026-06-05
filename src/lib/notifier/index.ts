import { ResendNotifier } from './resend';
import type { Notifier } from './notifier';

/** Notifier factory (lazy singleton). Swap implementation here to change channel. */
let notifier: Notifier | undefined;

export function getNotifier(): Notifier {
  if (!notifier) {
    notifier = new ResendNotifier();
  }
  return notifier;
}

/** Test seam: inject a fake notifier. */
export function setNotifier(n: Notifier): void {
  notifier = n;
}

export type { Notifier, ReminderMessage } from './notifier';
