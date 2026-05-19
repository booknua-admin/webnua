// /signup — the cold-traffic signup flow. Lives in the (auth) route group:
// no app shell, no role, no session required. See components/auth/signup.

import { SignupFlow } from '@/components/auth/signup/SignupFlow';

export default function SignupPage() {
  return <SignupFlow />;
}
