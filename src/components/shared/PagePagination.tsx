"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination";
import { useLang } from "@/providers/LanguageProvider";

/** Page list with ellipsis: 1 2 3 … 8 9 10 */
function pageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, "…", total - 2, total - 1, total];
  if (current >= total - 2) return [1, 2, 3, "…", total - 2, total - 1, total];
  return [1, "…", current - 1, current, current + 1, "…", total];
}

/**
 * Prev · page numbers · next for a server-paginated list (Riwayat transaksi,
 * Riwayat transfer). Renders nothing for a single page.
 *
 * `PaginationLink` is an `<a>`, which these pages cannot use: the page number
 * lives in component state, not in the URL, and prev/next need a real
 * `disabled` — a disabled anchor does not exist.
 */
export function PagePagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const { t } = useLang();
  if (totalPages <= 1) return null;
  return (
    <Pagination className="justify-between">
      <Button
        variant="outline"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
      >
        <ChevronLeft /> {t("tx.previous")}
      </Button>
      <PaginationContent className="hidden sm:flex">
        {pageList(currentPage, totalPages).map((p, i) => (
          <PaginationItem key={p === "…" ? `e${i}` : p}>
            {p === "…" ? (
              <PaginationEllipsis />
            ) : (
              <Button
                variant={p === currentPage ? "brand" : "ghost"}
                size="icon-sm"
                className="rounded-full"
                aria-current={p === currentPage ? "page" : undefined}
                onClick={() => onPageChange(p)}
              >
                {p}
              </Button>
            )}
          </PaginationItem>
        ))}
      </PaginationContent>
      <Button
        variant="outline"
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
      >
        {t("tx.next")} <ChevronRight />
      </Button>
    </Pagination>
  );
}
