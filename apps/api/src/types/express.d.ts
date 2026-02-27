import type { RequestUser } from "../auth/types";

declare global {
  namespace Express {
    interface User extends RequestUser {}

    interface Request {
      user?: User;
    }
  }
}

export {};
