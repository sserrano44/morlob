export type RouteContext<T> = {
  params: Promise<T>;
};

export async function routeParams<T>(context: RouteContext<T>) {
  return context.params;
}

export function clampInt(
  value: string | null,
  fallback: number,
  min: number,
  max: number
) {
  if (value === null || value.trim() === "") {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
}
