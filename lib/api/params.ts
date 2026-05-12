export type RouteContext<T> = {
  params: Promise<T>;
};

export async function routeParams<T>(context: RouteContext<T>) {
  return context.params;
}
