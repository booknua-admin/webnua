'use client';

// =============================================================================
// SectionFieldContext — carries the editing section's label down to the
// CopyField / MediaField inside a section's Fields component, without every
// section file having to thread it through.
//
// SectionFieldsPanel provides it; CopyField / MediaField read it so a
// request-change affordance can name the section the field belongs to.
// =============================================================================

import { createContext, useContext, type ReactNode } from 'react';

type SectionFieldContextValue = {
  /** Human label of the section being edited, e.g. "Hero". */
  sectionLabel: string | null;
};

const SectionFieldContext = createContext<SectionFieldContextValue>({
  sectionLabel: null,
});

export function SectionFieldContextProvider({
  sectionLabel,
  children,
}: {
  sectionLabel: string;
  children: ReactNode;
}) {
  return (
    <SectionFieldContext.Provider value={{ sectionLabel }}>
      {children}
    </SectionFieldContext.Provider>
  );
}

export function useSectionFieldContext(): SectionFieldContextValue {
  return useContext(SectionFieldContext);
}
