import { getX402Service } from "@/lib/x402/server/env";
import { handleRetryAnnouncement } from "@/lib/x402/server/http-handlers";

/** Idempotent retry of the ERC-5564 announcement for a settled payment. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handleRetryAnnouncement(id, getX402Service);
}
