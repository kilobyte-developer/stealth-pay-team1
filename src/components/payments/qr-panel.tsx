"use client";

import * as React from "react";
import { QRCodeSVG } from "qrcode.react";
import { Download, QrCode, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { useToast } from "@/components/ui/toast";

/**
 * Renders the stealth meta-address as a scannable QR code. The encoded payload
 * is the full `st:avax:…` URI, which is entirely public key material.
 */
export function QrPanel({
  value,
  caption,
}: {
  value: string;
  caption?: string;
}) {
  const [revealed, setRevealed] = React.useState(false);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const { toast } = useToast();

  function download() {
    const svg = svgRef.current;
    if (!svg) return;

    const source = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "stealthpay-meta-address.svg";
    a.click();
    URL.revokeObjectURL(url);

    toast({ tone: "success", title: "QR code downloaded" });
  }

  async function share() {
    // Web Share is unavailable on most desktop browsers; fall back to copying.
    // Checked via typeof rather than `in` so the fallback path stays reachable
    // for TypeScript (lib.dom always declares `share`).
    const canShare =
      typeof navigator !== "undefined" && typeof navigator.share === "function";

    if (canShare) {
      try {
        await navigator.share({
          title: "My StealthPay meta-address",
          text: value,
        });
      } catch {
        /* user dismissed the share sheet */
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      toast({
        tone: "info",
        title: "Copied instead",
        description: "Sharing is not available in this browser.",
      });
    } catch {
      toast({ tone: "warning", title: "Could not share or copy" });
    }
  }

  return (
    <div className="border-ink shadow-brutal border-2 bg-white p-5">
      <SectionLabel className="text-grey">QR code</SectionLabel>

      <div className="mt-4 flex justify-center">
        {revealed ? (
          <div className="animate-pop-in border-ink bg-white p-3 shadow-brutal-sm border-2">
            <QRCodeSVG
              ref={svgRef}
              value={value}
              size={180}
              level="M"
              marginSize={0}
              bgColor="#ffffff"
              fgColor="#111111"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="brutal-press border-ink bg-paper-2 shadow-brutal-xs hover:shadow-brutal-sm flex size-[198px] flex-col items-center justify-center gap-2 border-2 border-dashed"
          >
            <QrCode className="size-8" aria-hidden="true" />
            <span className="font-display text-xs font-bold tracking-wide uppercase">
              Reveal QR code
            </span>
          </button>
        )}
      </div>

      <p className="text-grey mt-4 text-center text-xs leading-relaxed">
        {caption ??
          "Encodes only public key material. Safe to display or share."}
      </p>

      <div className="mt-4 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={download}
          disabled={!revealed}
        >
          <Download className="size-3.5" aria-hidden="true" />
          Download
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={share}
        >
          <Share2 className="size-3.5" aria-hidden="true" />
          Share
        </Button>
      </div>
    </div>
  );
}
