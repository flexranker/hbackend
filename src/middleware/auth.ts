import type { Request, Response, NextFunction } from 'express';
import { getFirebaseAuth } from '../services/firebase.js';
import { AuthError } from '../utils/errors.js';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  emailVerified: boolean;
  displayName?: string;
  photoURL?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return next(new AuthError('No token provided'));
  }

  try {
    const user = await getFirebaseAuth().verifyIdToken(token);
    req.user = {
      uid: user.uid,
      email: user.email,
      emailVerified: user.email_verified ?? false,
      displayName: user.name,
      photoURL: user.picture,
    };
    next();
  } catch {
    next(new AuthError('Invalid token'));
  }
};
