"use client";

import Image from "next/image";
import Link from "next/link";

export interface BlogPostProps {
  title: string;
  author: {
    name: string;
    avatar: string;
    role: string;
  };
  date: string;
  readTime: string;
  tags: string[];
  featuredImage: string;
  content: string;
}

export function BlogPost({
  title,
  author,
  date,
  readTime,
  tags,
  featuredImage,
  content,
}: BlogPostProps) {
  return (
    <article className="max-w-4xl mx-auto">
      {/* Back Button */}
      <Link
        href="/blog"
        className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-8"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Blog
      </Link>

      {/* Header */}
      <header className="mb-8">
        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-6">
          {tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-1 rounded-full bg-white/10 text-white/60 text-sm font-medium"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-bold mb-6 text-white">{title}</h1>

        {/* Meta */}
        <div className="flex items-center gap-6 text-white/60">
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 rounded-full overflow-hidden bg-white/10">
              <Image
                src={author.avatar}
                alt={author.name}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
            <div>
              <div className="font-medium text-white">{author.name}</div>
              <div className="text-sm text-white/40">{author.role}</div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-white/40">
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{date}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{readTime}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Featured Image */}
      <div className="relative w-full h-[400px] rounded-2xl overflow-hidden mb-12 bg-white/5 shadow-2xl">
        <Image
          src={featuredImage}
          alt={title}
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a1a]/50 to-transparent"></div>
      </div>

      {/* Content */}
      <div className="bg-white/5 backdrop-blur-2xl rounded-2xl border border-white/10 p-8 md:p-12">
        <div
          className="prose prose-invert prose-lg max-w-none
            prose-headings:text-white prose-headings:font-semibold
            prose-h2:text-3xl prose-h2:mb-4 prose-h2:mt-8
            prose-h3:text-2xl prose-h3:mb-3 prose-h3:mt-6
            prose-p:text-white/60 prose-p:leading-relaxed prose-p:mb-4
            prose-a:text-purple-400 prose-a:no-underline hover:prose-a:text-purple-300
            prose-strong:text-white prose-strong:font-semibold
            prose-ul:text-white/60 prose-ul:my-4
            prose-li:mb-2
            prose-code:text-purple-300 prose-code:bg-white/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
            prose-pre:bg-white/5 prose-pre:border prose-pre:border-white/10 prose-pre:rounded-xl
            prose-blockquote:border-l-purple-500 prose-blockquote:border-l-4 prose-blockquote:pl-6 prose-blockquote:text-white/60 prose-blockquote:italic
          "
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    </article>
  );
}
