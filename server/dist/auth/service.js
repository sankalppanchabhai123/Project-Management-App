"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findOrCreateOAuthUser = findOrCreateOAuthUser;
const user_js_1 = require("./user.js");
function pickPrimaryEmail(profile, provider) {
    const email = profile.emails?.[0]?.value ?? profile._json?.email;
    if (email) {
        return email;
    }
    return `${provider.toLowerCase()}-${profile.id}@taskflow.local`;
}
function pickDisplayName(profile) {
    return profile.displayName ?? profile._json?.name ?? profile.username ?? 'Taskflow User';
}
function pickAvatar(profile) {
    return profile.photos?.[0]?.value ?? profile._json?.avatar_url ?? undefined;
}
async function findOrCreateOAuthUser(prisma, provider, profile) {
    const providerId = profile.id;
    const email = pickPrimaryEmail(profile, provider);
    const name = pickDisplayName(profile);
    const avatar = pickAvatar(profile);
    const existingUser = await prisma.user.findFirst({
        where: {
            OR: [{ provider, providerId }, { email }],
        },
        select: user_js_1.safeUserSelect,
    });
    if (existingUser) {
        const updatedUser = await prisma.user.update({
            where: { id: existingUser.id },
            data: {
                name,
                avatar,
                provider,
                providerId,
                email,
            },
            select: user_js_1.safeUserSelect,
        });
        return updatedUser;
    }
    return prisma.user.create({
        data: {
            email,
            name,
            avatar,
            provider,
            providerId,
        },
        select: user_js_1.safeUserSelect,
    });
}
