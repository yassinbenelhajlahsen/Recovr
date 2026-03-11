import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-6 text-center">
      <p className="font-display italic text-[8rem] leading-none text-accent font-bold select-none">
        404
      </p>

      <h1 className="mt-4 font-display italic text-3xl text-primary">
        Page not found
      </h1>

      <p className="mt-3 text-secondary max-w-xs">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>

      <Link
        href="/"
        className="mt-8 px-5 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-[var(--c-accent-hover)] transition-colors"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
