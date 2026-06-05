/** A channel-agnostic outbound reminder message. */
export interface ReminderMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Provider-agnostic notification contract. The reminder workflow depends only on
 * this interface, so swapping Resend for Slack/Discord/Telegram means writing one
 * new implementation — no workflow changes.
 */
export interface Notifier {
  readonly channel: string;
  send(message: ReminderMessage): Promise<void>;
}
