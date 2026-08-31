export function createLatestAssetLoader<T>() {
  let revision = 0;
  return {
    async load(
      value: T,
      decode: () => Promise<void>,
      apply: (value: T) => void,
    ): Promise<void> {
      const requestedRevision = ++revision;
      await decode();
      if (requestedRevision === revision) apply(value);
    },
    invalidate(): void {
      revision += 1;
    },
  };
}
