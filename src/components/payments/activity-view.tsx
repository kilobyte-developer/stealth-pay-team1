"use client";

import * as React from "react";
import { Filter, RefreshCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { PaymentsTable } from "@/components/payments/payments-table";
import { useStealthPayments } from "@/hooks/use-stealth-payments";
import { formatBlock } from "@/lib/format";

type AssetFilter = "all" | "native" | "erc20";
type SpendFilter = "all" | "spendable" | "needs-gas";
type SortOrder = "newest" | "oldest";

export function ActivityView() {
  const state = useStealthPayments();

  const [query, setQuery] = React.useState("");
  const [asset, setAsset] = React.useState<AssetFilter>("all");
  const [spend, setSpend] = React.useState<SpendFilter>("all");
  const [sort, setSort] = React.useState<SortOrder>("newest");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();

    const rows = state.payments.filter((p) => {
      if (asset === "native" && p.assetKind !== "native") return false;
      if (asset === "erc20" && p.assetKind !== "erc20") return false;
      if (spend === "spendable" && p.assetKind !== "native") return false;
      if (spend === "needs-gas" && p.assetKind === "native") return false;

      if (q) {
        const haystack = [
          p.stealthAddress,
          p.transactionHash,
          p.announcer,
          p.tokenSymbol ?? "",
          p.token ?? "",
          String(p.blockNumber),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    return [...rows].sort((a, b) => {
      const delta = Number(b.blockNumber - a.blockNumber);
      return sort === "newest" ? delta : -delta;
    });
  }, [state.payments, query, asset, spend, sort]);

  const dirty =
    query !== "" || asset !== "all" || spend !== "all" || sort !== "newest";

  function clearAll() {
    setQuery("");
    setAsset("all");
    setSpend("all");
    setSort("newest");
  }

  const showFilters = state.status === "ready" && state.payments.length > 0;

  return (
    <>
      {showFilters ? (
        <div className="border-ink shadow-brutal border-2 bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Filter className="size-4" aria-hidden="true" />
              <p className="font-display text-[0.7rem] font-bold tracking-[0.16em] uppercase">
                Search &amp; filter
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={state.rescan}>
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Rescan
            </Button>
          </div>

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="activity-search">Search</Label>
              <div className="relative">
                <Search
                  className="text-grey pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                  aria-hidden="true"
                />
                <Input
                  id="activity-search"
                  className="pl-10"
                  placeholder="Stealth address, transaction hash, token, block…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="filter-asset">Asset</Label>
                <Select
                  id="filter-asset"
                  value={asset}
                  onChange={(e) => setAsset(e.target.value as AssetFilter)}
                >
                  <option value="all">All assets</option>
                  <option value="native">Native AVAX</option>
                  <option value="erc20">Tokens</option>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="filter-spend">Spendable</Label>
                <Select
                  id="filter-spend"
                  value={spend}
                  onChange={(e) => setSpend(e.target.value as SpendFilter)}
                >
                  <option value="all">Any</option>
                  <option value="spendable">Spendable now</option>
                  <option value="needs-gas">Needs gas</option>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="filter-sort">Order</Label>
                <Select
                  id="filter-sort"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortOrder)}
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </Select>
              </div>
            </div>
          </div>

          <div className="border-ink/15 mt-4 flex flex-wrap items-center justify-between gap-3 border-t-2 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="white" size="sm">
                {filtered.length} of {state.payments.length}
              </Badge>
              {state.lastScannedBlock !== null ? (
                <span className="text-grey font-mono text-[0.7rem]">
                  scanned to block {formatBlock(Number(state.lastScannedBlock))}
                </span>
              ) : null}
            </div>
            {dirty ? (
              <Button variant="outline" size="sm" onClick={clearAll}>
                <X className="size-3.5" aria-hidden="true" />
                Clear filters
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className={showFilters ? "mt-6" : ""}>
        <PaymentsTable
          payments={filtered}
          status={state.status}
          reason={state.reason}
          error={state.error}
          progress={state.progress}
          rescan={state.rescan}
        />
      </div>
    </>
  );
}
