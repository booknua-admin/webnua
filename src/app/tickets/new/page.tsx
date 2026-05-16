import { Suspense } from 'react';

import { NewTicketForm } from './_form';

// /tickets/new — the ticket submit form. `NewTicketForm` reads the request
// URL via useSearchParams, so it sits behind a Suspense boundary.
export default function NewTicketPage() {
  return (
    <Suspense fallback={null}>
      <NewTicketForm />
    </Suspense>
  );
}
