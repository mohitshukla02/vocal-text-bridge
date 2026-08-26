// Assigns each speaker label a stable channel color (1-5) based on first-appearance
// order, so the same speaker always gets the same tag across transcript, history,
// and cost views within a session.
//
// Class names are listed literally (not built with template strings) so
// Tailwind's content scanner can find them — it only picks up class names
// that appear as-is in source text.
const BG_CLASSES = ['bg-channel-1', 'bg-channel-2', 'bg-channel-3', 'bg-channel-4', 'bg-channel-5'];
const TEXT_CLASSES = ['text-channel-1', 'text-channel-2', 'text-channel-3', 'text-channel-4', 'text-channel-5'];

function channelSlot(speakers: string[], speaker: string): number {
  const idx = speakers.indexOf(String(speaker));
  return (idx < 0 ? 0 : idx) % BG_CLASSES.length;
}

export function channelClass(speakers: string[], speaker: string): string {
  return BG_CLASSES[channelSlot(speakers, speaker)];
}

export function channelTextClass(speakers: string[], speaker: string): string {
  return TEXT_CLASSES[channelSlot(speakers, speaker)];
}
