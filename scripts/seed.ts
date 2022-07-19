import path from "path";
import fs from "fs/promises";
import * as semver from "semver";
import { installGlobals } from "@remix-run/node";
import parseFrontMatter from "front-matter";
import { processMarkdown } from "@ryanflorence/md";

import { saveDocs } from "../app/utils/docs/save-docs.server";
import type { BlogPostWithAuthors } from "../app/models/post";
import type { GitHubRelease } from "../app/@types/github";
import invariant from "ts-invariant";
import { prisma } from "../app/db.server";

installGlobals();

let blogPath = path.join(__dirname, "..", "data/posts");

async function seedBlog() {
  // simplest to just clear the existing DB tables before we seed
  console.log("> Deleting old blog posts");
  await prisma.blogPost.deleteMany();
  console.log("> Deleted old blog posts");

  let posts = await getBlogPosts();
  let promises = posts.map(async ({ authors, ...post }) => {
    console.log(`> Adding blog post: ${post.slug}`);
    let newPost = await prisma.blogPost.create({
      data: {
        ...post,
        authors: {
          connectOrCreate: authors.map((author) => {
            return {
              create: author,
              where: {
                name: author.name,
              },
            };
          }),
        },
      },
    });
    console.log(`> Added blog post: ${post.slug}`);
    return newPost;
  });

  await Promise.all(promises);
}

async function getBlogPosts(): Promise<BlogPostWithAuthors[]> {
  let files = await fs.readdir(blogPath);
  let listings: Array<BlogPostWithAuthors> = [];
  for (let file of files) {
    if (file.endsWith(".md")) {
      const slug = file.replace(/\.md$/, "");
      let post = await getBlogPost(slug);
      listings.push(post);
    }
  }
  return listings.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

async function seedDocs() {
  invariant(
    process.env.REPO_LATEST_BRANCH,
    "REPO_LATEST_BRANCH is not defined"
  );

  let releasesPromise = await fetch(
    `https://api.github.com/repos/${process.env.REPO}/releases`,
    {
      headers: {
        accept: "application/vnd.github.v3+json",
      },
    }
  );

  let releases = (await releasesPromise.json()) as GitHubRelease[];

  let sortedReleases = releases
    .map((release) =>
      release.tag_name.includes("@")
        ? release.tag_name.slice(release.tag_name.indexOf("@") + 1)
        : release.tag_name
    )
    .filter((release) => semver.valid(release))
    .sort((a, b) => semver.rcompare(a, b));

  let latestRelease = sortedReleases.at(0);

  invariant(latestRelease, "latest release is not defined");
  console.log(`Using latest Remix release: ${latestRelease}`);

  let releasesToUse = releases.filter((release) => {
    return semver.satisfies(release.tag_name, `>=${latestRelease}`, {
      includePrerelease: true,
    });
  });

  let promises: Promise<void>[] = [];

  for (let release of releasesToUse) {
    promises.unshift(saveDocs(`refs/tags/${release.tag_name}`, release.body));
  }

  await Promise.all(promises);
  await saveDocs(process.env.REPO_LATEST_BRANCH, "");
}

try {
  Promise.all([seedBlog(), seedDocs()]);
} catch (error) {
  throw error;
}

export async function getBlogPost(slug: string): Promise<BlogPostWithAuthors> {
  let result = await md(slug + ".md");
  if (!result) {
    throw new Response("Not Found", { status: 404, statusText: "Not Found" });
  }
  let { attributes, html, body } = result;
  invariant(
    isMarkdownPostFrontmatter(attributes),
    `Invalid post frontmatter in ${slug}`
  );
  let post: MarkdownPost = { ...attributes, slug, html, md: body };
  return mdToBlogPost(post);
}

async function md(filename: string) {
  let filePath = path.join(blogPath, filename);
  try {
    await fs.access(filePath);
  } catch (e) {
    return null;
  }
  let contents = (await fs.readFile(filePath)).toString();
  let { attributes, body } = parseFrontMatter(contents);
  let html = await processMarkdown(body);
  let obj = { attributes, html, body };
  return obj;
}

function mdToBlogPost(md: MarkdownPost): BlogPostWithAuthors {
  let post: BlogPostWithAuthors = {
    slug: md.slug,
    title: md.title,
    authors: md.authors,
    date: md.date.toString(),
    image: md.image,
    imageAlt: md.imageAlt,
    createdAt: md.date,
    updatedAt: md.date,
    html: md.html,
    md: md.md,
  };
  return post;
}

function isMarkdownPostFrontmatter(obj: any): obj is MarkdownPost {
  return (
    typeof obj === "object" &&
    obj.title &&
    obj.summary &&
    obj.date instanceof Date &&
    (typeof obj.draft === "boolean" || typeof obj.draft === "undefined") &&
    (typeof obj.featured === "boolean" ||
      typeof obj.featured === "undefined") &&
    obj.image &&
    obj.imageAlt &&
    Array.isArray(obj.authors) &&
    obj.authors.every(
      (author: any) =>
        typeof author === "object" &&
        author.name &&
        author.title &&
        author.avatar
    )
  );
}

interface MarkdownPost {
  title: string;
  summary: string;
  date: Date;
  draft?: boolean;
  featured?: boolean;
  image: string;
  imageAlt: string;
  authors: Author[];
  html: string;
  md: string;
  slug: string;
}

interface Author {
  name: string;
  title: string;
  avatar: string;
}

async function getFileCreatedDate(file: string) {
  let { birthtime } = await fs.stat(file);
  return birthtime;
}
