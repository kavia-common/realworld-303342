import {default as jwt} from "jsonwebtoken";

export interface PrivateContext {
    auth: {
        id: number;
    }
}

/**
 * Extracts a JWT from an Authorization header.
 * Accepts `Token <jwt>` and `Bearer <jwt>` formats.
 */
const getAuthTokenFromHeader = (authorizationHeader?: string) => {
    if (
        (authorizationHeader && authorizationHeader.split(' ')[0] === 'Token') ||
        (authorizationHeader && authorizationHeader.split(' ')[0] === 'Bearer')
    ) {
        return authorizationHeader.split(' ')[1];
    }

    return undefined;
};

/**
 * Verifies a JWT and returns the decoded payload.
 * NOTE: Behavior preserved: we keep `jwt.verify` throwing as-is when invalid,
 * and still do a falsy check afterwards.
 */
const verifyToken = (token: string) => jwt.verify(token, process.env.JWT_SECRET);

export function definePrivateEventHandler<T>(
    handler: (event: H3Event, cxt: PrivateContext) => T,
    options: { requireAuth: boolean } = {requireAuth: true}
) {
    return defineEventHandler(async (event) => {
        // you can check request hmac, user, token, etc..
        const authorizationHeader = getHeader(event, 'authorization');
        const token = getAuthTokenFromHeader(authorizationHeader);

        // Required-auth: reject when there is no token
        if (options.requireAuth && !token) {
            throw createError({
                status: 401,
                statusMessage: 'Unauthorized',
                message: 'Missing authentication token'
            });
        }

        // Optional-auth: proceed unauthenticated when there is no token
        if (!token) {
            return handler(event, {auth: null});
        }

        const verified = verifyToken(token);

        if (!verified) {
            throw createError({
                status: 403,
                statusMessage: 'Unauthorized',
                message: 'Invalid authentication token'
            });
        }

        return handler(event, {
            auth: {
                id: Number(verified.user.id)
            },
        })
    })
}
