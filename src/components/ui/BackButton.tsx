"use client";

export function BackButton() {
  return (
    <button
      type="button"
      onClick={() => history.back()}
      className="text-sm text-muted hover:text-secondary transition-colors duration-150"
    >
      &larr; Back
    </button>
  );
}
