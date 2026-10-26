export function go(route: string): void {
  location.hash = route ? `#/${route}` : '#/';
}

export function currentRoute(): string {
  return location.hash.replace(/^#\/?/, '').split('?')[0];
}
