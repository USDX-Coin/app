"use client";

// Sel yang dipakai bersama oleh baris order (mint/redeem) dan baris transfer di
// /history (USDX-713): jumlah USDX, tx hash + tombol salin, dan menu ⋯ per baris.
// Baris transfer masuk memakai menu yang sama persis ("pola baris mint/redeem",
// custodial-wallet.md §5.7).

import { Copy, ExternalLink, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { getChainById } from "@/lib/chains";
import { formatTokenAmount, truncateAddress } from "@/lib/utils";
import { useLang } from "@/providers/LanguageProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface OnChainRef {
  chain: string;
  txHash: string | null;
}

// Block explorer tx link for the row's chain, or null when the chain has no
// known explorer or the tx hasn't landed on-chain yet (txHash null).
function explorerTxUrl(chain: string, txHash: string | null): string | null {
  if (!txHash) return null;
  const url = getChainById(chain)?.explorerUrl;
  return url ? `${url}/tx/${txHash}` : null;
}

function useCopy() {
  const { t } = useLang();
  return (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t("toast.copied"));
  };
}

export function AmountCell({ amount }: { amount: string }) {
  const { lang } = useLang();
  return (
    <span className="flex items-center justify-end gap-1.5 tabular-nums text-foreground">
      <img src="/image/usdx-coin.svg" alt="" className="size-4 rounded-full" />
      {formatTokenAmount(amount, lang)}
    </span>
  );
}

export function TxHashCell({ chain, txHash }: OnChainRef) {
  const { t } = useLang();
  const copy = useCopy();
  const url = explorerTxUrl(chain, txHash);
  if (!txHash) return <span className="text-muted-text">—</span>;
  return (
    <span className="flex items-center gap-1 text-foreground">
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-text underline-offset-4 hover:underline"
        >
          {truncateAddress(txHash, 4)}
        </a>
      ) : (
        truncateAddress(txHash, 4)
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => copy(txHash)}
            aria-label={t("common.copy")}
            className="text-muted-text"
          >
            <Copy className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("common.copy")}</TooltipContent>
      </Tooltip>
    </span>
  );
}

/**
 * Menu ⋯ per baris (Figma 8). Figma memasang tiga entri: "Lihat detail",
 * "Buka di explorer", "Salin hash". "Lihat detail" butuh Sheet detail +
 * Steps timeline yang belum ada di produk, jadi ia TIDAK dirender — entri
 * menu yang tidak membuka apa pun lebih buruk daripada menu berisi dua.
 *
 * Dua entri yang tersisa sama-sama butuh tx hash. Baris yang belum mendarat
 * on-chain karena itu tidak dapat pemicu sama sekali, bukan tombol yang
 * membuka menu kosong. Kolomnya tetap ada supaya lebar tabel tidak bergoyang
 * antar baris.
 */
export function RowActions({ chain, txHash }: OnChainRef) {
  const { t } = useLang();
  const copy = useCopy();
  const url = explorerTxUrl(chain, txHash);
  if (!txHash) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("tx.rowActions")}
          className="text-muted-text"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {url && (
          // `asChild` is stripped by the Animate UI item, so this cannot be an
          // `<a>`; `noopener` is passed explicitly instead of inherited from
          // `rel`.
          <DropdownMenuItem
            onSelect={() => window.open(url, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink />
            {t("tx.openExplorer")}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => copy(txHash)}>
          <Copy />
          {t("tx.copyHash")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
