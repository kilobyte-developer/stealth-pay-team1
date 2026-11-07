"use client";

import * as React from "react";
import { Filter, RefreshCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { ActivityTable } from "@/components/payments/activity-table";
import {
  activityRowFromLocalEntry,
  activityRowFromPayment,
  toPaymentRow,
  type ActivityRow,
} from "@/lib/payments/view-model";
import { useStealthPayments } from "@/hooks/use-stealth-payments";
import { useLocalActivity } from "@/hooks/use-local-activity";
import { useActiveNetwork } from "@/providers/wallet-provider";
import { formatBlock } from "@/lib/format";

type DirectionFilter = "all" | "incoming" | "sent" | "forwarded";
type AssetFilter = "all" | "native" | "erc20";
type SortOrder = "newest" | "oldest";

export function ActivityView() {
  const network = useActiveNetwork();
  const state = useStealthPayments();
  const local = useLocalActivity(network);

  const [query, setQuery] = React.useState("");
  const [direction, setDirection] = React.useState<DirectionFilter>("all");
  const [asset, setAsset] = React.useState<AssetFilter>("all");
  const [sort, setSort] = React.useState<SortOrder>("newest");

  const allRows = React.useMemo<ActivityRow[]>(() => {
    const incoming = state.payments.map(toPaymentRow).map(activityRowFromPayment);
    const sent = local.entries.map(activityRowFromLocalEntry);
    return [...incoming, ...sent];
  }, [state.payments, local.entries]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();

    const rows = allRows.filter((row) => {
      if (direction !== "all" && row.direction !== direction) return false;
      // ERC-20 vs native: a native asset's label is always "AVAX"; anything
      // else is a token, for incoming and local rows alike.
      if (asset === "native" && row.assetLabel !== "AVAX") return false;
      if (asset === "erc20" && row.assetLabel === "AVAX") return false;

      if (q) {
        const haystack = [row.from ?? "", row.to, row.transactionHash, row.assetLabel]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    return [...rows].sort((a, b) => {
      const ab = a.blockNumber ?? 0n;
      const bb = b.blockNumber ?? 0n;
      const delta = ab > bb ? 1 : ab < bb ? -1 : 0;
      return sort === "newest" ? -delta : delta;
    });
  }, [allRows, query, direction, asset, sort]);

  const dirty =
    query !== "" || direction !== "all" || asset !== "all" || sort !== "newest";

  function clearAll() {
    setQuery("");
    setDirection("all");
    setAsset("all");
    setSort("newest");
  }

  function handleForwarded() {
    state.rescan();
    local.refresh();
  }

  const showFilters = allRows.length > 0;

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
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                state.rescan();
                local.refresh();
              }}
            >
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
                  placeholder="Address, transaction hash, asset…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="filter-direction">Type</Label>
                <Select
                  id="filter-direction"
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as DirectionFilter)}
                >
                  <option value="all">All activity</option>
                  <option value="incoming">Received</option>
                  <option value="sent">Sent</option>
                  <option value="forwarded">Forwarded</option>
                </Select>
              </div>

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
                {filtered.length} of {allRows.length}
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
        <ActivityTable
          network={network}
          rows={filtered}
          status={state.status}
          reason={state.reason}
          error={state.error}
          progress={state.progress}
          rescan={state.rescan}
          onForwarded={handleForwarded}
        />
      </div>
    </>
  );
}
