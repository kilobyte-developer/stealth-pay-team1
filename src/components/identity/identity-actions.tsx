"use client";

import * as React from "react";
import { Download, RefreshCw, ShieldAlert, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NotBroadcastNotice } from "@/components/ui/demo-tag";
import { SectionLabel } from "@/components/ui/section-label";

/**
 * Key backup and identity regeneration. Both are deliberately gated behind an
 * explicit acknowledgement step, and neither performs a destructive action in
 * this preview build.
 */
export function IdentityActions() {
  const [exportOpen, setExportOpen] = React.useState(false);
  const [regenOpen, setRegenOpen] = React.useState(false);
  const [ack, setAck] = React.useState(false);
  const [regenAck, setRegenAck] = React.useState(false);

  function closeExport(open: boolean) {
    setExportOpen(open);
    if (!open) setAck(false);
  }

  function closeRegen(open: boolean) {
    setRegenOpen(open);
    if (!open) setRegenAck(false);
  }

  return (
    <div className="border-ink shadow-brutal border-2 bg-white p-5 sm:p-6">
      <SectionLabel className="text-grey">Identity management</SectionLabel>
      <p className="text-grey mt-2 text-sm leading-relaxed">
        These operations touch the material that controls your funds. Both are
        gated behind a confirmation step.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <Button variant="secondary" size="md" onClick={() => setExportOpen(true)}>
          <Download className="size-4" aria-hidden="true" />
          Back up keys
        </Button>
        <Button variant="coral" size="md" onClick={() => setRegenOpen(true)}>
          <RefreshCw className="size-4" aria-hidden="true" />
          Regenerate identity
        </Button>
      </div>

      {/* ---- Backup flow ---- */}
      <Dialog open={exportOpen} onOpenChange={closeExport}>
        <DialogContent>
          <DialogHeader>
            <div className="border-ink bg-coral mb-4 inline-flex size-11 items-center justify-center border-2">
              <ShieldAlert className="size-5" aria-hidden="true" />
            </div>
            <DialogTitle>Back up your stealth keys</DialogTitle>
            <DialogDescription>
              Read this before continuing. A key backup is as powerful as the
              funds it controls.
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-2.5">
            {[
              "Anyone who obtains your private spending key can move every payment ever sent to your meta-address.",
              "Anyone who obtains your private viewing key can see all of your incoming payments, permanently.",
              "A backup must never be stored in cloud notes, chat apps, screenshots or email.",
              "StealthPay never transmits key material — a backup is written only by your own browser.",
            ].map((w) => (
              <li key={w} className="flex gap-2.5">
                <TriangleAlert
                  className="mt-0.5 size-4 shrink-0 text-coral-deep"
                  aria-hidden="true"
                />
                <span className="text-xs leading-relaxed">{w}</span>
              </li>
            ))}
          </ul>

          <label className="border-ink mt-5 flex cursor-pointer items-start gap-3 border-2 bg-paper-2 p-3">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              className="border-ink accent-lime mt-0.5 size-4 shrink-0 border-2"
            />
            <span className="text-xs leading-relaxed">
              I understand that exposing these keys means losing both the
              privacy and the funds associated with this identity.
            </span>
          </label>

          {ack ? (
            <NotBroadcastNotice className="mt-4">
              <strong className="font-display">Nothing to export yet.</strong>{" "}
              This preview has not generated a keypair, so there is no private
              key on this device to back up. When client-side key generation is
              implemented, this step will produce an encrypted local backup
              file.
            </NotBroadcastNotice>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => closeExport(false)}>
              Close
            </Button>
            <Button variant="primary" disabled={!ack}>
              <Download className="size-4" aria-hidden="true" />
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Regeneration flow ---- */}
      <Dialog open={regenOpen} onOpenChange={closeRegen}>
        <DialogContent>
          <DialogHeader>
            <div className="border-ink bg-coral mb-4 inline-flex size-11 items-center justify-center border-2">
              <TriangleAlert className="size-5" aria-hidden="true" />
            </div>
            <DialogTitle>Regenerate your stealth identity?</DialogTitle>
            <DialogDescription>
              This creates a completely new, unrelated identity. It is not a
              rotation or an upgrade.
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-2.5">
            {[
              "Your current meta-address stops being the one you should share. Anyone still holding it will pay into the old identity.",
              "Funds already received do NOT move. They stay at their existing one-time addresses, spendable only with the old spending key.",
              "You must keep a backup of the old keys to access any past or in-flight payments.",
              "Payments sent to the old meta-address after regeneration will not appear under the new identity.",
            ].map((w) => (
              <li key={w} className="flex gap-2.5">
                <span
                  className="bg-coral border-ink mt-1.5 size-2.5 shrink-0 border-2"
                  aria-hidden="true"
                />
                <span className="text-xs leading-relaxed">{w}</span>
              </li>
            ))}
          </ul>

          <label className="border-ink mt-5 flex cursor-pointer items-start gap-3 border-2 bg-paper-2 p-3">
            <input
              type="checkbox"
              checked={regenAck}
              onChange={(e) => setRegenAck(e.target.checked)}
              className="border-ink accent-lime mt-0.5 size-4 shrink-0 border-2"
            />
            <span className="text-xs leading-relaxed">
              I understand a new identity does not migrate existing funds, and
              that I need my old keys to reach them.
            </span>
          </label>

          {regenAck ? (
            <NotBroadcastNotice className="mt-4">
              <strong className="font-display">Disabled in this build.</strong>{" "}
              Key generation is not implemented, so no identity is created or
              replaced. The demo meta-address stays exactly as it is.
            </NotBroadcastNotice>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => closeRegen(false)}>
              Cancel
            </Button>
            <Button variant="coral" disabled={!regenAck}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
