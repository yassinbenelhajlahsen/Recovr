"use client";

type Props = {
  onRetry?: () => void;
};

export function FetchError({ onRetry }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
      <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center text-danger">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-primary">Something went wrong</p>
        <p className="text-xs text-muted">Please try again later.</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-xs font-medium text-secondary transition-colors hover:border-border hover:bg-elevated hover:text-primary active:scale-95"
        >
         Retry
        </button>
      )}
    </div>
  );
}
