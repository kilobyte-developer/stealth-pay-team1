"use client";

import {
  CircleAlert,
  CircleCheck,
  Download,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { RecoveryStatus } from "@/lib/vault";

const META: Record<
  RecoveryStatus,
  {
    label: string;
    tone: "lime" | "coral" | "muted" | "white";
    Icon: typeof CircleCheck;
    detail: string;
  }
> = {
  not_configured: {
    label: "Backup not configured",
    tone: "coral",
    Icon: CircleAlert,
    detail:
      "No encrypted vault exists. An identity created now would be lost on refresh.",
  },
  vault_encrypted: {
    label: "Encrypted vault ready",
    tone: "white",
    Icon: ShieldCheck,
    detail:
      "Keys are encrypted on this device and survive a refresh — but not a cleared profile or a lost device.",
  },
  backup_exported: {
    label: "Backup downloaded, not confirmed",
    tone: "white",
    Icon: Download,
    detail:
      "A backup file was generated. Downloading it is not proof it was stored safely.",
  },
  recovery_verified: {
    label: "Recovery ready",
    tone: "lime",
    Icon: CircleCheck,
    detail:
      "Encrypted on this device, and you have confirmed an off-device backup.",
  },
  locked: {
    label: "Locked",
    tone: "muted",
    Icon: LockKeyhole,
    detail: "An encrypted vault exists but is not unlocked in this session.",
  },
};

export function RecoveryStatusBadge({
  status,
  size = "md",
}: {
  status: RecoveryStatus;
  size?: "sm" | "md";
}) {
  const { label, tone, Icon } = META[status];
  return (
    <Badge tone={tone} size={size}>
      <Icon className="size-3" aria-hidden="true" />
      {label}
    </Badge>
  );
}

/**
 * Explains what the current recovery state actually guarantees.
 *
 * Deliberately avoids overstating: only `recovery_verified` reflects a user
 * claim of off-device backup, and even that is a claim rather than proof.
 */
export function RecoveryStatusDetail({ status }: { status: RecoveryStatus }) {
  return (
    <p className="text-grey text-xs leading-relaxed">{META[status].detail}</p>
  );
}

/** True only when the identity is genuinely recoverable off this device. */
export function isRecoveryReady(status: RecoveryStatus): boolean {
  return status === "recovery_verified";
}
