import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border-subtle py-8 text-center text-xs text-muted">
      <div className="flex items-center justify-center gap-2">
        <Link href="/privacy" className="hover:text-secondary transition-colors duration-150">
          Privacy Policy
        </Link>
        <span>&middot;</span>
        <Link href="/terms-of-service" className="hover:text-secondary transition-colors duration-150">
          Terms of Service
        </Link>
      </div>
      <p className="mt-2">&copy; {new Date().getFullYear()} Recvr. All rights reserved.</p>
    </footer>
  );
}
