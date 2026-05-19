export type AuthUser = {
  walletAddress: string;
  userId: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
