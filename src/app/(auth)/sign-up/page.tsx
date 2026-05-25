// =============================================================================
// /sign-up — conversational onboarding (Session B).
//
// Replaces the wizard-based sign-up surface (now moved to /sign-up/legacy).
// The chat shell owns the entire UX: turn-1 freeform → email capture →
// 6-digit verification → workspace provisioning → session mint → turn-2
// placeholder (Session C fills the rest).
//
// Page itself is a thin wrapper: the shell is the whole surface, mounted
// against the (auth) layout so it inherits the auth chrome.
// =============================================================================

import { ConversationShell } from './_conversation-shell';

export default function SignUpPage() {
  return <ConversationShell />;
}
