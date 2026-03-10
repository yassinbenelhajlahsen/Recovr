// src/components/ui/PasswordChecklist.tsx
"use client";

const requirements = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "One number", test: (p: string) => /[0-9]/.test(p) },
  {
    label: "One special character",
    test: (p: string) => /[^A-Za-z0-9]/.test(p),
  },
];

export function passwordMeetsRequirements(password: string): boolean {
  return requirements.every(({ test }) => test(password)) && !/\s/.test(password);
}

export function PasswordChecklist({ password }: { password: string }) {
  return (
  <>
    <ul className="space-y-1.5">
      {requirements.map(({ label, test }) => {
        const met = password.length > 0 && test(password);
        const touched = password.length > 0;
        return (
          <li
            key={label}
            className={`flex items-center gap-2 text-xs transition-colors duration-200 ${
              met
                ? "text-success"
                : touched
                ? "text-danger"
                : "text-muted"
            }`}
          >
            {met ? (
              <svg
                className="w-3.5 h-3.5 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
            ) : (
              <svg
                className="w-3.5 h-3.5 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <circle cx="12" cy="12" r="9" />
              </svg>
            )}
            {label}
          </li>
        );
      })}
    </ul>
    {password.includes(" ") && (
      <p className="text-xs text-danger mt-1.5">Password cannot contain spaces</p>
    )}
  </>
  );
}
