export const iconNames = [
  "calendar",
  "clock",
  "folder",
  "arrow-left",
  "arrow-up",
  "github",
  "rss",
  "refresh"
] as const;

export type IconName = (typeof iconNames)[number];

export function socialIcon(label: string): IconName {
  const key = label.toLowerCase();
  if (key.includes("github")) return "github";
  if (key.includes("rss")) return "rss";
  return "github";
}
