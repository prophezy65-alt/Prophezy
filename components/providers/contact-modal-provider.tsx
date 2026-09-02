"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import ContactModal from "@/components/marketing/ContactModal";

interface ContactModalContextValue {
  openContact: () => void;
  closeContact: () => void;
}

const ContactModalContext = createContext<ContactModalContextValue | null>(null);

// Mirrors the existing ToastProvider pattern: state lives here, the visual is
// mounted once at the root, and any component anywhere in the tree (Navbar,
// Footer, a future "Contact us" button, etc.) can trigger it via the hook
// below without prop-drilling across unrelated component trees.
export function ContactModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openContact = useCallback(() => setIsOpen(true), []);
  const closeContact = useCallback(() => setIsOpen(false), []);

  const value = useMemo(() => ({ openContact, closeContact }), [openContact, closeContact]);

  return (
    <ContactModalContext.Provider value={value}>
      {children}
      <ContactModal isOpen={isOpen} onClose={closeContact} />
    </ContactModalContext.Provider>
  );
}

export function useContactModal(): ContactModalContextValue {
  const ctx = useContext(ContactModalContext);
  if (!ctx) {
    throw new Error("useContactModal must be used within a ContactModalProvider");
  }
  return ctx;
}
