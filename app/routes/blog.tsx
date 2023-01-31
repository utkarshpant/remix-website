import * as React from "react";
import type {
  HeadersFunction,
  LoaderArgs,
  MetaFunction,
} from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { json } from "@remix-run/node";
import { Footer } from "~/components/footer";
import { Header } from "~/components/header";
import { Subscribe } from "~/components/subscribe";
import { CACHE_CONTROL } from "~/utils/http.server";
import { getBlogPostListings } from "~/utils/md.server";

export let meta: MetaFunction = () => {
  return {
    title: "Remix Blog",
    description:
      "Thoughts about building excellent user experiences with Remix.",
  };
};

export const loader = async (_: LoaderArgs) => {
  return json(
    { posts: await getBlogPostListings() },
    { headers: { "Cache-Control": CACHE_CONTROL.DEFAULT } }
  );
};

export const headers: HeadersFunction = () => {
  return {
    "Cache-Control": CACHE_CONTROL.DEFAULT,
  };
};

export default function Blog() {
  const data = useLoaderData<typeof loader>();
  const [latestPost, ...posts] = data.posts;

  let featuredPosts = data.posts.filter((post) => post.featured);

  return (
    <div className="flex flex-col flex-1 h-full">
      <Header />
      <main
        className="flex flex-col flex-1 container mt-16 lg:mt-32"
        tabIndex={-1}
      >
        <div className="md:grid md:grid-cols-12">
          <div className="md:col-span-7">
            <div className="mb-14">
              <Link to={latestPost.slug} prefetch="intent">
                <div className="aspect-h-9 aspect-w-16 mb-6">
                  <img
                    className="object-cover object-top w-full h-full md:rounded-md mb-6 shadow"
                    src={latestPost.image}
                    alt={latestPost.imageAlt}
                  />
                </div>
                <p className="text-sm lg:text-base">{latestPost.dateDisplay}</p>
                <p className="text-2xl font-bold lg:text-5xl">
                  {latestPost.title}
                </p>
                <p className="text-sm lg:text-base">{latestPost.summary}</p>
              </Link>
            </div>
            <div className="mt-12 lg:grid lg:grid-cols-2 lg:gap-6">
              {posts.map((post) => (
                <div key={post.slug}>
                  <Link to={post.slug} prefetch="intent">
                    <div className="aspect-h-9 aspect-w-16 mb-6">
                      <img
                        className="object-cover object-top h-full w-full md:rounded-md shadow"
                        src={post.image}
                        alt={post.imageAlt}
                      />
                    </div>
                    <p className="text-sm lg:text-base">{post.dateDisplay}</p>
                    <p className="text-lg font-bold lg:text-xl">{post.title}</p>
                    <p className="text-sm lg:text-base mb-12">{post.summary}</p>
                  </Link>
                </div>
              ))}
            </div>
          </div>
          <div className="md:hidden h-24" />
          <div className="md:col-span-4 md:col-start-9">
            {featuredPosts.length ? (
              <>
                <h3 className="text-xl font-bold mb-8 lg:text-3xl">
                  Featured Articles
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  {featuredPosts.map((post, index, array) => (
                    <React.Fragment key={post.slug}>
                      <div className="flex flex-col">
                        <div className="flex flex-col">
                          <Link
                            to={post.slug}
                            prefetch="intent"
                            className="text-sm lg:text-base"
                          >
                            {post.title}
                          </Link>
                        </div>
                      </div>
                      {index !== array.length - 1 && <hr className="my-4" />}
                    </React.Fragment>
                  ))}
                </div>
                <div className="h-24" />
              </>
            ) : null}
            <div>
              <h3 className="text-xl font-bold mb-6 lg:text-3xl">
                Get updates on the latest Remix news
              </h3>
              <div className="mb-6" id="newsletter-text">
                Be the first to learn about new Remix features, community
                events, and tutorials.
              </div>
              <Subscribe descriptionId="newsletter-text" />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
