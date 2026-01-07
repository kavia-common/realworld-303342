import HttpException from "~/models/http-exception.model";
import { default as bcrypt } from "bcryptjs";
import { validateUserRegistrationBody } from "~/utils/validation";

export default defineEventHandler(async (event) => {
    const startMs = Date.now();
    const route = "POST /api/users";

    console.info("[api]", {
        event: "request_start",
        route,
    });

    try {
        const body = await readBody(event);

        // Schema-ish validation with predictable error body:
        // - 422 Unprocessable Entity
        // - { errors: { field: [message] } }
        const validated = validateUserRegistrationBody(body);
        if (!validated.ok) {
            console.warn("[api]", {
                event: "registration_validation_failed",
                route,
                reason: "invalid_body",
                fields: Object.keys(validated.errors),
            });
            throw new HttpException(422, { errors: validated.errors });
        }

        const { email, username, password, image, bio, demo } = validated.value;

        // Do not log request bodies or passwords. Keep identifiers minimal.
        console.info("[api]", {
            event: "registration_attempt",
            route,
            email: email ?? null,
            username: username ?? null,
        });

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
