import type { Metadata } from 'next';
import { StaffSignInScreen } from './StaffSignInScreen';

export const metadata: Metadata = { title: 'Staff sign-in' };

export default function StaffSignInPage() {
  return <StaffSignInScreen />;
}
