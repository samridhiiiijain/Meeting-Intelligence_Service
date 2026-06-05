import { Resend } from 'resend';
import { env } from '../../config/env';
import { AppError } from '../../utils/errors';
import type { Notifier, ReminderMessage } from './notifier';

/**
 * Resend (email) implementation of Notifier — the mandatory third-party
 * integration, actively invoked by the reminder workflow.
 */
export class ResendNotifier implements Notifier {
  public readonly channel = 'email';
  private readonly client: Resend;

  constructor() {
    if (!env.RESEND_API_KEY) {
      throw AppError.dependency('RESEND_API_KEY is not configured');
    }
    this.client = new Resend(env.RESEND_API_KEY);
  }

  async send(message: ReminderMessage): Promise<void> {
    const { data, error } = await this.client.emails.send({
      from: env.RESEND_FROM,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });

    if (error) {
      throw AppError.dependency('Failed to send reminder email', {
        provider: 'resend',
        message: error.message,
      });
    }
    if (!data) {
      throw AppError.dependency('Resend returned no message id');
    }
  }
}
