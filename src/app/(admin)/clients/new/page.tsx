import { redirect } from 'next/navigation';

export default function NewClientIndexPage() {
  redirect('/clients/new/basics');
}
