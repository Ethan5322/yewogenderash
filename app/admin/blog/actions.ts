"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/admin/permissions";
import { writeAudit } from "@/lib/audit";
import { slugify } from "@/lib/blog";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const postSchema = z.object({
  title: z.string().trim().min(4, "Title is too short").max(160),
  excerpt: z.string().trim().min(10, "Add a short summary").max(300),
  body: z.string().trim().min(20, "Post body is too short").max(50_000),
  coverImageUrl: z.string().trim().url("Enter a valid image URL").max(500).optional().or(z.literal("")),
});

/** Ensure the slug is unique, appending -2, -3… as needed. */
async function uniqueSlug(base: string, exceptId?: string): Promise<string> {
  const root = base || "post";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const clash = await db.blogPost.findFirst({
      where: { slug: candidate, NOT: exceptId ? { id: exceptId } : undefined },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
  return `${root}-${Date.now()}`;
}

export async function createPostAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requirePermission("content");
  const parsed = postSchema.safeParse({
    title: formData.get("title"),
    excerpt: formData.get("excerpt"),
    body: formData.get("body"),
    coverImageUrl: formData.get("coverImageUrl"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the fields" };
  }

  const slug = await uniqueSlug(slugify(parsed.data.title));
  const post = await db.blogPost.create({
    data: {
      slug,
      title: parsed.data.title,
      excerpt: parsed.data.excerpt,
      body: parsed.data.body,
      coverImageUrl: parsed.data.coverImageUrl || null,
      status: "DRAFT",
      authorId: admin.id,
    },
    select: { id: true },
  });

  await writeAudit({
    actorId: admin.id,
    action: "BLOG_POST_CREATED",
    entityType: "BlogPost",
    entityId: post.id,
    detail: { slug, title: parsed.data.title },
  });

  revalidatePath("/admin/blog");
  return { ok: true, id: post.id };
}

export async function updatePostAction(
  postId: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requirePermission("content");
  const parsed = postSchema.safeParse({
    title: formData.get("title"),
    excerpt: formData.get("excerpt"),
    body: formData.get("body"),
    coverImageUrl: formData.get("coverImageUrl"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the fields" };
  }

  const existing = await db.blogPost.findUnique({
    where: { id: postId },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Post not found." };

  await db.blogPost.update({
    where: { id: postId },
    data: {
      title: parsed.data.title,
      excerpt: parsed.data.excerpt,
      body: parsed.data.body,
      coverImageUrl: parsed.data.coverImageUrl || null,
    },
  });

  await writeAudit({
    actorId: admin.id,
    action: "BLOG_POST_UPDATED",
    entityType: "BlogPost",
    entityId: postId,
  });

  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  return { ok: true, id: postId };
}

/** Toggle publish state. Publishing stamps publishedAt the first time. */
export async function setPostStatusAction(
  postId: string,
  publish: boolean
): Promise<ActionResult> {
  const admin = await requirePermission("content");
  const post = await db.blogPost.findUnique({
    where: { id: postId },
    select: { id: true, publishedAt: true },
  });
  if (!post) return { ok: false, error: "Post not found." };

  await db.blogPost.update({
    where: { id: postId },
    data: {
      status: publish ? "PUBLISHED" : "DRAFT",
      publishedAt: publish ? (post.publishedAt ?? new Date()) : post.publishedAt,
    },
  });

  await writeAudit({
    actorId: admin.id,
    action: publish ? "BLOG_POST_PUBLISHED" : "BLOG_POST_UNPUBLISHED",
    entityType: "BlogPost",
    entityId: postId,
  });

  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  return { ok: true };
}

export async function deletePostAction(postId: string): Promise<ActionResult> {
  const admin = await requirePermission("content");
  await db.blogPost.delete({ where: { id: postId } }).catch(() => null);
  await writeAudit({
    actorId: admin.id,
    action: "BLOG_POST_DELETED",
    entityType: "BlogPost",
    entityId: postId,
  });
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  redirect("/admin/blog");
}
