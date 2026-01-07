import HttpException from "~/models/http-exception.model";
import { default as bcrypt } from "bcryptjs";

export default defineEventHandler(async (event) => {
    const startMs = Date.now();
    const route = "POST /api/users";

    console.info("[api]", {
        event: "request_start",
        route,
    });

    try {
        const { user } = await readBody(event);

        const email = user.email?.trim();
        const username = user.username?.trim();
        const password = user.password?.trim();
        const { image, bio, demo } = user;

        // Do not log request bodies or passwords. Keep identifiers minimal.
        console.info("[api]", {
            event: "registration_attempt",
            route,
            email: email ?? null,
            username: username ?? null,
        });

        if (!email) {
            console.warn("[api]", {
                event: "registration_validation_failed",
                route,
                reason: "missing_email",
            });
            throw new HttpException(422, { errors: { email: ["can't be blank"] } });
        }

        if (!username) {
            console.warn("[api]", {
                event: "registration_validation_failed",
                route,
                reason: "missing_username",
            });
            throw new HttpException(422, { errors: { username: ["can't be blank"] } });
        }

        if (!password) {
            console.warn("[api]", {
                event: "registration_validation_failed",
                route,
                reason: "missing_password",
            });
            throw new HttpException(422, { errors: { password: ["can't be blank"] } });
        }

        await checkUserUniqueness(email, username);

        const hashedPassword = await bcrypt.hash(password, 10);

        const createdUser = await usePrisma().user.create({
            data: {
                username,
                email,
                password: hashedPassword,
                ...(image ? { image } : {}),
                ...(bio ? { bio } : {}),
                ...(demo ? { demo } : {}),
            },
            select: {
                id: true,
                email: true,
                username: true,
                bio: true,
                image: true,
            },
        });

        console.info("[api]", {
            event: "registration_success",
            route,
            userId: createdUser.id,
        });

        return {
            user: {
                ...createdUser,
                token: useGenerateToken(createdUser.id),
            },
        };
    } catch (err: any) {
        console.error("[api]", {
            event: "request_error",
            route,
            status: err?.statusCode ?? err?.status ?? undefined,
            message: err?.message,
        });
        throw err;
    } finally {
        console.info("[api]", {
            event: "request_end",
            route,
            durationMs: Date.now() - startMs,
        });
    }
});

const checkUserUniqueness = async (email: string, username: string) => {
    const existingUserByEmail = await usePrisma().user.findUnique({
        where: {
            email,
        },
        select: {
            id: true,
        },
    });

    const existingUserByUsername = await usePrisma().user.findUnique({
        where: {
            username,
        },
        select: {
            id: true,
        },
    });

    if (existingUserByEmail || existingUserByUsername) {
        // Keep concise; do not log full details. This helps trace decisions in CI/dev logs.
        console.warn("[api]", {
            event: "registration_uniqueness_failed",
            route: "POST /api/users",
            emailTaken: Boolean(existingUserByEmail),
            usernameTaken: Boolean(existingUserByUsername),
        });

        throw new HttpException(422, {
            errors: {
                ...(existingUserByEmail ? { email: ["has already been taken"] } : {}),
                ...(existingUserByUsername ? { username: ["has already been taken"] } : {}),
            },
        });
    }
};
