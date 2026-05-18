'use client';

// =============================================================================
// EditJobNotesModal — edits the job notes on a booking. Stub layer: Save
// logs the next value and closes (real persistence lands with the backend).
// The parent mounts this only while open, so it opens with fresh state.
// =============================================================================

import { useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export type EditJobNotesModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialNotes: string;
  onSave?: (notes: string) => void;
};

export function EditJobNotesModal({
  open,
  onOpenChange,
  initialNotes,
  onSave,
}: EditJobNotesModalProps) {
  const [notes, setNotes] = useState(initialNotes);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="default" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Edit job notes</DialogTitle>
          <DialogDescription>
            Anything the person running the job should know — access, parking,
            on-site details.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={6}
          className="font-sans"
          placeholder="Notes for this job…"
        />
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSave?.(notes);
              onOpenChange(false);
            }}
          >
            Save notes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
