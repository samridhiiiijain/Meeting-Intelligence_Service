import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { signToken } from '../src/middleware/auth';

describe('signToken', () => {
  it('produces a verifiable JWT carrying the user id and email', () => {
    const token = signToken({ sub: 'user-123', email: 'a@b.com' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      sub: string;
      email: string;
    };
    expect(decoded.sub).toBe('user-123');
    expect(decoded.email).toBe('a@b.com');
  });

  it('produces a token that fails verification under a wrong secret', () => {
    const token = signToken({ sub: 'x', email: 'y@z.com' });
    expect(() => jwt.verify(token, 'wrong-secret')).toThrow();
  });
});
