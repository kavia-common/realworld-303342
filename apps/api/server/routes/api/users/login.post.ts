import HttpException from "~/models/http-exception.model";
import {default as bcrypt} from 'bcryptjs';

export default defineEventHandler(async (event) => {
    const startMs = Date.now();
    const route = 'POST /api/users/login';

    // Avoid logging request bodies; only log minimal identifying info.
    console.info('[api]', {
        event: 'request_start',
        route,
    });

    try {
        const {user} = await readBody(event);

        const email = user.email?.trim();
        const password = user.password?.trim();

        // Redact sensitive fields; do not log passwords or full bodies.
        console.info('[api]', {
            event: 'login_attempt',
            route,
            email: email ?? null,
        });

        if (!email) {
            console.warn('[api]', {
                event: 'login_validation_failed',
                route,
                reason: 'missing_email',
            });
            throw new HttpException(422, {errors: {email: ["can't be blank"]}});
        }

        if (!password) {
            console.warn('[api]', {
                event: 'login_validation_failed',
                route,
                reason: 'missing_password',
            });
            throw new HttpException(422, {errors: {password: ["can't be blank"]}});
        }

        const foundUser = await usePrisma().user.findUnique({
            where: {
                email,
            },
            select: {
                id: true,
                email: true,
                username: true,
                password: true,
                bio: true,
                image: true,
            },
        });

        if (foundUser) {
            const match = await bcrypt.compare(password, foundUser.password);

            if (match) {
                console.info('[api]', {
                    event: 'login_success',
                    route,
                    userId: foundUser.id,
                });

                return {
                    user: {
                        email: foundUser.email,
                        username: foundUser.username,
                        bio: foundUser.bio,
                        image: foundUser.image,
                        token: useGenerateToken(foundUser.id),
                    }
                };
            }
        }

        console.warn('[api]', {
            event: 'login_failed',
            route,
            reason: 'invalid_credentials',
            // User id unknown in this branch without leaking info; keep minimal.
        });

        throw new HttpException(403, {
            errors: {
                'email or password': ['is invalid'],
            },
        });
    } catch (err: any) {
        // Keep logs minimal and non-sensitive
        console.error('[api]', {
            event: 'request_error',
            route,
            status: err?.statusCode ?? err?.status ?? undefined,
            message: err?.message,
        });
        throw err;
    } finally {
        console.info('[api]', {
            event: 'request_end',
            route,
            durationMs: Date.now() - startMs,
        });
    }
});
