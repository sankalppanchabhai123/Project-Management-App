"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeUserSelect = void 0;
exports.toSafeUser = toSafeUser;
exports.safeUserSelect = {
    id: true,
    email: true,
    name: true,
    avatar: true,
    provider: true,
    providerId: true,
    createdAt: true,
    updatedAt: true,
};
function toSafeUser(user) {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        provider: user.provider,
        providerId: user.providerId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    };
}
