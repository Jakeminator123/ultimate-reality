// Times are relative to the local excerpts, whose cuts start at Howcast frame 4248 and VIP time 78.2 s.
export const dealReferences = [
  {
    title: "Howcast · spader två",
    view: "Ovanifrån · bar filt",
    file: "qd5oc9hLrXg/spader-tva-4248-4307.mp4",
    sha256: "eea1f5ebd5564864e22040de2d3b428726e8f9024f18f8f20def0b193b2e70fc",
    source: "https://www.youtube.com/watch?v=qd5oc9hLrXg&t=177s",
    draw: (4259 - 4248) * 1001 / 24000,
    handover: (4274 - 4248) * 1001 / 24000,
    release: (4300 - 4248) * 1001 / 24000,
  },
  {
    title: "VIP · klöver nio",
    view: "Snett framifrån · på knekten",
    file: "AZ2sb5B_JmA/klover-nio-spelarutdrag.mp4",
    sha256: "05b2d66334a8fabdeb827167eb4e1cd537d989853ba14b225c80514a392c49f0",
    source: "https://www.youtube.com/watch?v=AZ2sb5B_JmA&t=78s",
    draw: 0,
    handover: 0.7,
    release: 1.4,
  },
] as const;
