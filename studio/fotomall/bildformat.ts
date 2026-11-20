export const bildformat = {
  person: { ratio: "2448:3264", proportions: "3:4" },
  hand: { ratio: "3504:2336", proportions: "3:2" },
  kortdrag: { ratio: "3840:2160", proportions: "16:9" },
} as const;

export function leveransformat(format: typeof bildformat[keyof typeof bildformat]) {
  return "PNG · " + format.ratio.replace(":", " × ") + " px · " + format.proportions;
}
