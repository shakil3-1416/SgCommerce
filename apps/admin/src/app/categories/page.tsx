import {
  CategoryManager,
} from '@/components/category-manager';

export default function CategoriesPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#4c2a7d]">
        Catalog
      </p>

      <h1 className="mt-2 text-4xl font-bold text-[#1f1235]">
        Categories
      </h1>

      <p className="mt-3 text-[#6f6679]">
        Create and maintain storefront categories.
      </p>

      <div className="mt-8">
        <CategoryManager />
      </div>
    </main>
  );
}
