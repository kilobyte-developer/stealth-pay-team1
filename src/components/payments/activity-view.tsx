"use client";

import * as React from "react";
import { ArrowDownUp, Filter, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { ActivityTable } from "@/components/payments/activity-table";
import { ASSETS } from "@/config/networks";
import type { StealthTransaction, TxDirection, TxStatus } from "@/types";

type DirectionFilter = "all" | TxDirection;
type StatusFilter = "all" | TxStatus;
type SortOrder = "newest" | "oldest";

const DEFAULTS = {
  query: "",
  direction: "all" as DirectionFilter,
  status: "all" as StatusFilter,
  asset: "all",
  sort: "newest" as SortOrder,
};

export function ActivityView({
  transactions,
}: {
  transactions: StealthTransaction[];
}) {
  const [query, setQuery] = React.useState(DEFAULTS.query);
  const [direction, setDirection] = React.useState<DirectionFilter>(
    DEFAULTS.direction,
  );
  const [status, setStatus] = React.useState<StatusFilter>(DEFAULTS.status);
  const [asset, setAsset] = React.useState(DEFAULTS.asset);
  const [sort, setSort] = React.useState<SortOrder>(DEFAULTS.sort);

  const assetOptions = React.useMemo(() => {
    const present = new Set(transactions.map((t) => t.assetSymbol));
    return ASSETS.filter((a) => present.has(a.symbol)).map((a) => a.symbol);
  }, [transactions]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();

    const rows = transactions.filter((t) => {
      if (direction !== "all" && t.direction !== direction) return false;
      if (status !== "all" && t.status !== status) return false;
      if (asset !== "all" && t.assetSymbol !== asset) return false;

      if (q) {
        const haystack = [
          t.txHash,
          t.stealthAddress,
          t.counterparty,
          t.counterpartyLabel ?? "",
          t.assetSymbol,
          t.note ?? "",
          String(t.blockNumber),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });

    return rows.sort((a, b) => {
      const delta =
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      return sort === "newest" ? delta : -delta;
    });
  }, [transactions, query, direction, status, asset, sort]);

  const dirty =
    query !== DEFAULTS.query ||
    direction !== DEFAULTS.direction ||
    status !== DEFAULTS.status ||
    asset !== DEFAULTS.asset ||
    sort !== DEFAULTS.sort;

  function clearAll() {
    setQuery(DEFAULTS.query);
    setDirection(DEFAULTS.direction);
    setStatus(DEFAULTS.status);
    setAsset(DEFAULTS.asset);
    setSort(DEFAULTS.sort);
  }

  return (
    <>
      {/* Filter bar */}
      <div className="border-ink shadow-brutal border-2 bg-white p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Filter className="size-4" aria-hidden="true" />
          <p className="font-display text-[0.7rem] font-bold tracking-[0.16em] uppercase">
            Search &amp; filter
          </p>
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
                placeholder="Hash, stealth address, counterparty, block, note…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="filter-direction">Type</Label>
              <Select
                id="filter-direction"
                value={direction}
                onChange={(e) =>
                  setDirection(e.target.value as DirectionFilter)
                }
              >
                <option value="all">All types</option>
                <option value="incoming">Received</option>
                <option value="outgoing">Sent</option>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-status">Status</Label>
              <Select
                id="filter-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusFilter)}
              >
                <option value="all">All statuses</option>
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-asset">Asset</Label>
              <Select
                id="filter-asset"
                value={asset}
                onChange={(e) => setAsset(e.target.value)}
              >
                <option value="all">All assets</option>
                {assetOptions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-sort">Sort by date</Label>
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
              <ArrowDownUp className="size-3" aria-hidden="true" />
              {filtered.length} of {transactions.length}
            </Badge>
            {dirty ? (
              <Badge tone="lime" size="sm">
                Filters active
              </Badge>
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

      <div className="mt-6">
        <ActivityTable transactions={filtered} />
      </div>
    </>
  );
}
