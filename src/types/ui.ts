import type { ReactNode, RefObject, ChangeEvent, HTMLAttributes } from "react";
import type { User } from "@supabase/supabase-js";
import type { UnitSystem, UserProfile } from "@/types/user";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  headerRight?: ReactNode;
  size?: "default" | "lg";
  children: ReactNode;
}

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export interface DropdownMenuProps {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  align?: "left" | "right";
}

export type FloatingInputProps = {
  id: string;
  type: "text" | "email" | "password" | "date";
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  label: string;
  leftIcon?: ReactNode;
  rightSlot?: ReactNode;
  inputRef?: RefObject<HTMLInputElement | null>;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: "on" | "off";
  spellCheck?: boolean;
  disabled?: boolean;
  className?: string;
  error?: string;
  // Visual customizations (optional — CSS variable names preferred)
  focusColor?: string;
  borderColor?: string;
  labelColor?: string;
};

export interface UserMenuProps {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  user: User;
  onOpenSettings: () => void;
  onSignOut: () => void;
  onboarding?: boolean;
}

export interface MetricsInputsProps {
  idPrefix: string;
  height: string;
  onHeightChange: (v: string) => void;
  weight: string;
  onWeightChange: (v: string) => void;
  unitSystem: UnitSystem;
  onUnitSystemChange: (s: UnitSystem) => void;
}

export interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  user: UserProfile;
}

export interface FitnessTabProps {
  user: UserProfile;
  open: boolean;
  onClose: () => void;
}
