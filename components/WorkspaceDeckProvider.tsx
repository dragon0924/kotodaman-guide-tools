"use client";

import { createContext, useContext, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { DeckCharacter } from "@/lib/types";

const initialDeck: DeckCharacter[] = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1,
  letters: index === 0 ? ["こ", "ご", "と"] : index === 1 ? ["う", "く"] : index === 2 ? ["か", "が"] : [],
}));
const DeckContext = createContext<{ deck: DeckCharacter[]; setDeck: Dispatch<SetStateAction<DeckCharacter[]>> } | null>(null);

export function WorkspaceDeckProvider({ children }: { children: ReactNode }) {
  const [deck, setDeck] = useState(initialDeck);
  const value = useMemo(() => ({ deck, setDeck }), [deck]);
  return <DeckContext.Provider value={value}>{children}</DeckContext.Provider>;
}

export function useWorkspaceDeck() {
  const context = useContext(DeckContext);
  if (!context) throw new Error("WorkspaceDeckProvider is required");
  return context;
}
