import { getX402Service } from "@/lib/x402/server/env";
import { handleGetPayment } from "@/lib/x402/server/http-handlers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handleGetPayment(id, getX402Service);
}
