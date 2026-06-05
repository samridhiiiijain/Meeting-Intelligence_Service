import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma';
import { signToken } from '../../middleware/auth';
import { AppError } from '../../utils/errors';
import type { LoginInput, RegisterInput } from './auth.schemas';

const SALT_ROUNDS = 10;

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

function toPublicUser(u: {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}): PublicUser {
  return { id: u.id, email: u.email, name: u.name, createdAt: u.createdAt };
}

export const authService = {
  async register(input: RegisterInput): Promise<{ user: PublicUser; token: string }> {
    const email = input.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw AppError.conflict('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    const user = await prisma.user.create({
      data: { email, passwordHash, name: input.name },
    });

    const token = signToken({ sub: user.id, email: user.email });
    return { user: toPublicUser(user), token };
  },

  async login(input: LoginInput): Promise<{ user: PublicUser; token: string }> {
    const email = input.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    // Always run a comparison-ish path to reduce trivial user-enumeration timing.
    if (!user) {
      throw AppError.unauthorized('Invalid email or password');
    }
    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw AppError.unauthorized('Invalid email or password');
    }

    const token = signToken({ sub: user.id, email: user.email });
    return { user: toPublicUser(user), token };
  },

  async me(userId: string): Promise<PublicUser> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppError.notFound('User not found');
    return toPublicUser(user);
  },
};
