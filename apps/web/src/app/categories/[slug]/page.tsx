import type { Metadata } from "next";
import { CATEGORY_MAP } from "@/lib/category-meta";
import { CategoryBrowser } from "./category-browser";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const meta = CATEGORY_MAP[slug];

  if (!meta) {
    return {
      title: "Category not found — Estate Scout",
    };
  }

  const title = `${meta.label} for Sale — Estate Scout`;
  const description = `Browse ${meta.label.toLowerCase()} listings from estate sales and regional auction houses. ${meta.description}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    alternates: {
      canonical: `/categories/${slug}`,
    },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  return <CategoryBrowser slug={slug} />;
}
