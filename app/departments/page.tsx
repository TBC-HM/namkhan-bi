// app/departments/page.tsx
import { redirect } from 'next/navigation';

export default function DepartmentsIndex() {
  redirect('/departments/roots');
}
