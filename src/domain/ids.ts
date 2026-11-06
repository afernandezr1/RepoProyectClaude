/** Local-only random IDs. Not used for anything security-sensitive. */
export function newId(): string {
  const rnd = () =>
    Math.floor(Math.random() * 0x100000000)
      .toString(16)
      .padStart(8, '0');
  return `${Date.now().toString(36)}-${rnd()}${rnd()}`;
}
