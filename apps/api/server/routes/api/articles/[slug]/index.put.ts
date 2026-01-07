import HttpException from "~/models/http-exception.model";
import articleMapper from "~/utils/article.mapper";
import slugify from "slugify";
import { definePrivateEventHandler } from "~/auth-event-handler";

export default definePrivateEventHandler(async (event, { auth }) => {
    const startMs = Date.now();
    const route = "PUT /api/articles/:slug";

    console.info("[api]", {
        event: "request_start",
        route,
    });

    try {
        const { article } = await readBody(event);
        const slug = getRouterParam(event, "slug");

        console.info("[api]", {
            event: "article_update_attempt",
            route,
            slug,
            userId: auth.id,
            fields: Object.keys(article ?? {}).filter((k) => k !== "body"), // avoid implying body is logged
            hasBody: Boolean(article?.body), // boolean only
        });

        let newSlug: string | null = null;

        const existingArticle = await usePrisma().article.findFirst({
            where: {
                slug,
            },
            select: {
                author: {
                    select: {
                        id: true,
                        username: true,
                    },
                },
            },
        });

        if (!existingArticle) {
            console.warn("[api]", {
                event: "article_update_not_found",
                route,
                slug,
                userId: auth.id,
            });
            throw new HttpException(404, {});
        }

        if (existingArticle.author.id !== auth.id) {
            console.warn("[api]", {
                event: "article_update_forbidden",
                route,
                slug,
                userId: auth.id,
                authorId: existingArticle.author.id,
            });
            throw new HttpException(403, {
                message: "You are not authorized to update this article",
            });
        }

        if (article.title) {
            newSlug = `${slugify(article.title)}-${auth.id}`;

            if (newSlug !== slug) {
                const existingTitle = await usePrisma().article.findFirst({
                    where: {
                        slug: newSlug,
                    },
                    select: {
                        slug: true,
                    },
                });

                if (existingTitle) {
                    console.warn("[api]", {
                        event: "article_update_rejected",
                        route,
                        slug,
                        userId: auth.id,
                        reason: "new_slug_exists",
                    });
                    throw new HttpException(422, { errors: { title: ["must be unique"] } });
                }
            }
        }

        const tagList =
            Array.isArray(article.tagList) && article.tagList?.length
                ? article.tagList.map((tag: string) => ({
                      create: { name: tag },
                      where: { name: tag },
                  }))
                : [];

        await disconnectArticlesTags(slug);

        const updatedArticle = await usePrisma().article.update({
            where: {
                slug,
            },
            data: {
                ...(article.title ? { title: article.title } : {}),
                ...(article.body ? { body: article.body } : {}),
                ...(article.description ? { description: article.description } : {}),
                ...(newSlug ? { slug: newSlug } : {}),
                updatedAt: new Date(),
                tagList: {
                    connectOrCreate: tagList,
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
            event: "article_update_success",
            route,
            userId: auth.id,
            slug,
            newSlug: newSlug ?? undefined,
        });

        return { article: articleMapper(updatedArticle, auth.id) };
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

const disconnectArticlesTags = async (slug: string) => {
    await usePrisma().article.update({
        where: {
            slug,
        },
        data: {
            tagList: {
                set: [],
            },
        },
    });
};
