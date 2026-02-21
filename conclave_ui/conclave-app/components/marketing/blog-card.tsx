"use client";

import Link from "next/link";
import Image from "next/image";

export interface BlogCardProps {
  slug: string;
  title: string;
  excerpt: string;
  author: {
    name: string;
    avatar: string;
  };
  date: string;
  readTime: string;
  tags: string[];
  featuredImage: string;
  featured?: boolean;
}

export function BlogCard({
  slug,
  title,
  excerpt,
  author,
  date,
  readTime,
  tags,
  featuredImage,
  featured = false,
}: BlogCardProps) {
  return (
    <Link href={`/blog/${slug}`}>
      <article
        className={`relative bg-white/5 backdrop-blur-2xl rounded-2xl border border-white/10 overflow-hidden hover:border-white/20 transition-all group ${
          featured ? "border-purple-500/30" : ""
        }`}
      >
        {/* Featured Badge */}
        {featured && (
          <div className="absolute -top-3 left-6 px-3 py-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full text-xs font-bold z-10 text-white">
            FEATURED
          </div>
        )}

        {/* Featured Image */}
        <div className="relative w-full h-48 overflow-hidden bg-white/5">
          <Image
            src={featuredImage}
            alt={title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a1a] via-transparent to-transparent"></div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-4">
            {tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 rounded-full bg-white/10 text-white/60 text-xs font-medium"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Title */}
          <h3 className="text-xl font-semibold mb-3 text-white group-hover:text-purple-300 transition-colors line-clamp-2">
            {title}
          </h3>

          {/* Excerpt */}
          <p className="text-white/60 leading-relaxed mb-4 line-clamp-3">
            {excerpt}
          </p>

          {/* Meta */}
          <div className="flex items-center gap-4 text-sm text-white/40">
            <div className="flex items-center gap-2">
              <div className="relative w-6 h-6 rounded-full overflow-hidden bg-white/10">
                <Image
                  src={author.avatar}
                  alt={author.name}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
              <span className="text-white/60">{author.name}</span>
            </div>
            <div className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{date}</span>
            </div>
            <div className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{readTime}</span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
