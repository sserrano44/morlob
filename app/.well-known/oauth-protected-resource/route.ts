import {
  corsPreflight,
  jsonWithCors,
  protectedResourceMetadata
} from "@/lib/oauth/http";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return corsPreflight();
}

export function GET(request: Request) {
  return jsonWithCors(protectedResourceMetadata(request));
}
