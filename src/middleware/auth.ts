import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../utils/errors';

export interface JwtPayload {
  sub: string; // user id
  email: string;
}

// Sign a JWT for an authenticated user. 
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

// Auth guard. Requires a valid `Authorization: Bearer <jwt>` header, verifies it,
// and attaches `{ id, email }` to req.user. Rejects missing/invalid/expired tokens with a 401 envelope.
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header('authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw AppError.unauthorized('Missing or malformed Authorization header');
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = { id: decoded.sub, email: decoded.email };
    next();
  } catch {
    throw AppError.unauthorized('Invalid or expired token');
  }
}
