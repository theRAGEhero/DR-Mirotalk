import { NextResponse } from "next/server";
import { getPlanViewer } from "@/lib/planGuests";
import { getPlanRecapData, isPlanRecapError } from "@/lib/planRecap";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const viewer = await getPlanViewer(_request, params.id);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { recap } = await getPlanRecapData(params.id, viewer);
    return NextResponse.json(recap);
  } catch (error) {
    if (isPlanRecapError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
