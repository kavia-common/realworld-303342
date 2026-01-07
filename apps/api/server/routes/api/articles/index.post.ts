import articleMapper from "~/utils/article.mapper";
import HttpException from "~/models/http-exception.model";
import slugify from "slugify";
import { definePrivateEventHandler } from "~/auth-event-handler";

export default definePrivateEventHandler(async (event, { auth }) => {
    const startMs = Date.now();
    const route = "POST /api/articles";

    console.info("[api]", {
        event: "request_start",
        route,
    });

    try {
        const { article } = await readBody(event);

        const { title, description, body, tagList } = article;
        const tags = Array.isArray(tagList) ? tagList : [];

        // Never log the article body; only minimal metadata.
        console.info("[api]", {
            event: "article_create_attempt",
            route,
            userId: auth.id,
            title: title ?? null,
            tagsCount: tags.length,
        });

        if (!title) {
            console.warn("[api]", {
                event: "article_create_validation_failed",
                route,
                reason: "missing_title",
            });
            throw new HttpException(422, { errors: { title: ["can't be blank"] } });
        }

        if (!description) {
            console.warn("[api]", {
                event: "article_create_validation_failed",
                route,
                reason: "missing_description",
            });
            throw new HttpException(422, { errors: { description: ["can't be blank"] } });
        }

        if (!body) {
            console.warn("[api]", {
                event: "article_create_validation_failed",
                route,
                reason: "missing_body",
            });
            throw new HttpException(422, { errors: { body: ["can't be blank"] } });
        }

        const slug = `${slugify(title)}-${auth.id}`;

        const existingTitle = await usePrisma().article.findUnique({
            where: {
                slug,
            },
            select: {
                slug: true,
            },
        });

        if (existingTitle) {
            console.warn("[api]", {
                event: "article_create_rejected",
                route,
                reason: "slug_exists",
                userId: auth.id,
            });
            throw new HttpException(422, { errors: { title: ["must be unique"] } });
        }

        const { authorId, id: articleId, ...createdArticle } = await usePrisma().article.create({
            data: {
                title,
                description,
                body,
                slug,
                tagList: {
                    connectOrCreate: tags.map((tag: string) => ({
                        create: { name: tag },
                        where: { name: tag },
                    })),
                },
                author: {
                    connect: {
                        id: auth.id,
                    },
                },
            },
            include: {
                tagList: {
                    select: {
                        name: true,
                    },
                },
                author: {
                    select: {
                        username: true,
                        bio: true,
                        image: true,
                        followedBy: true,
                    },
                },
                favoritedBy: true,
                _count: {
                    select: {
                        favoritedBy: true,
                    },
                },
            },
        });

        console.info("[api]", {
            event: "article_create_success",
            route,
            userId: auth.id,
            slug: (createdArticle as any).slug,
        });

        return { article: articleMapper(createdArticle, auth.id) };
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
