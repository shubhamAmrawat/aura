// Adds the authenticated user to Express's Request type (set by requireAuth / optionalAuth).
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}

export {};
