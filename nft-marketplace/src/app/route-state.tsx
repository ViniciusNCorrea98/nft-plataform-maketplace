export function RouteState({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <main data-testid="route-state">
      <h1>{title}</h1>
      <p>{detail}</p>
    </main>
  );
}
