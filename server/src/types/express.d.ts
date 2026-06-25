import type { SafeUser } from '../auth/user.js';

declare global {
    namespace Express {
        interface User extends SafeUser { }
        interface Request {
            user?: SafeUser;
        }
    }
}

export { };