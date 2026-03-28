"use client";

import Link from "next/link";

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface CategoriesBarProps {
  categories: Category[];
  activeCategory?: string;
}

const CategoriesBar = ({ categories, activeCategory }: CategoriesBarProps) => {
  return (
    <div className="flex gap-3 flex-wrap mt-6">
      <Link
        href="/"
        className="text-xs px-4 py-2 rounded-full border transition-all duration-200 tracking-wider"
        style={{
          background: !activeCategory ? "var(--accent)" : "transparent",
          color: !activeCategory ? "var(--bg-primary)" : "var(--text-secondary)",
          borderColor: !activeCategory ? "var(--accent)" : "var(--border)",
          
        }}
      >
        All
      </Link>
      {categories.map((cat) => (
        <Link
          key={cat.id}
          href={activeCategory === cat.slug ? "/" : `/?category=${cat.slug}`}
          className="text-xs px-4 py-2 rounded-full border transition-all duration-200 tracking-wider"
          style={{
            background: activeCategory === cat.slug ? "var(--accent)" : "transparent",
            color: activeCategory === cat.slug ? "var(--bg-primary)" : "var(--text-secondary)",
            borderColor: activeCategory === cat.slug ? "var(--accent)" : "var(--border)",
          }}
        >
          {cat.name}
        </Link>
      ))}
    </div>
  );
};

export default CategoriesBar;
