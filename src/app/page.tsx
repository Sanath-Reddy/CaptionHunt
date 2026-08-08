import { redirect } from 'next/navigation';

// Redirect / to the (app) group's search page
export default function RootPage() {
  redirect('/search');
}
