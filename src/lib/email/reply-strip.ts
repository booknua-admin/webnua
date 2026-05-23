// =============================================================================
// Strip quoted reply history from an inbound email body.
//
// Email clients (Gmail, Outlook, Apple Mail, …) include the full previous
// thread below the user's actual reply, indented with `>` markers OR
// preceded by a delimiter line like "On <date>, <name> wrote:". Persisting
// the whole quoted block makes the lead-timeline bubble unreadable — the
// reply IS already in our thread, the quoted copy is duplication.
//
// Strategy: pure heuristic — no full RFC 3676 parser, no HTML tree walk.
// Find the earliest occurrence of any common delimiter, truncate there,
// then trim trailing leading-`>` lines + whitespace. Cheap, deterministic,
// safe (never strips MORE than it should — if no delimiter matches, the
// original text returns unchanged).
//
// SERVER + CLIENT safe — pure string ops, no dependencies.
// =============================================================================

/** Patterns that introduce a quoted thread below a user's reply. Each
 *  match deletes from the line containing it onwards. Anchored to line
 *  start so a quoted occurrence of e.g. "From:" inside the user's actual
 *  text isn't matched.
 *
 *  - Gmail / Apple Mail: "On <weekday>, <date> at <time>, <name> wrote:"
 *  - Generic: "On <date>, <name> wrote:"
 *  - Outlook (older): "-----Original Message-----"
 *  - Outlook (newer): "From: <name>\nSent: <date>\nTo: …"
 *  - Apple Mail forwarded: "Begin forwarded message:"
 *  - Mailing-list separator: "----- Reply above this line -----"
 */
const REPLY_DELIMITERS: RegExp[] = [
  /^On\s.{1,120}\swrote:$/im,
  /^-{2,}\s*Original\s+Message\s*-{2,}\s*$/im,
  /^From:\s.+$/im,
  /^Begin forwarded message:/im,
  /^-{2,}\s*Reply\s+above\s+this\s+line.*$/im,
  /^Sent from my (iPhone|iPad|Android|Galaxy|Pixel|mobile)/im,
];

/** Strip the quoted thread from an inbound plain-text email body.
 *
 *  Returns the original input when no delimiter matches and there are
 *  no leading-`>` quote lines — i.e. safe to call unconditionally on
 *  every inbound message body.
 */
export function stripQuotedReply(body: string): string {
  if (!body) return body;
  let text = body.replace(/\r\n/g, '\n');

  // Cut at the earliest delimiter line.
  let earliest = -1;
  for (const re of REPLY_DELIMITERS) {
    const match = re.exec(text);
    if (match && (earliest === -1 || match.index < earliest)) {
      earliest = match.index;
    }
  }
  if (earliest >= 0) text = text.slice(0, earliest);

  // Trim trailing lines that are pure quote markers OR start with `>`.
  // These can sit between the reply and the delimiter, or below a
  // delimiter we missed.
  const lines = text.split('\n');
  while (lines.length > 0) {
    const last = lines[lines.length - 1].trim();
    if (last === '' || last.startsWith('>')) {
      lines.pop();
    } else {
      break;
    }
  }
  return lines.join('\n').trim();
}
