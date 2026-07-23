export default function AppLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="sticky top-0 z-40 border-b border-black/[0.06] bg-background/80 px-6 py-3.5 backdrop-blur-xl backdrop-saturate-150 sm:px-8 dark:border-white/[0.08]">
        <div className="mx-auto flex h-7 max-w-6xl items-center">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <main className="flex flex-1 items-center justify-center px-6 py-10 sm:px-8 sm:py-12">
        <div className="size-6 animate-spin rounded-full border-2 border-muted border-t-foreground/40" />
      </main>
    </div>
  );
}
