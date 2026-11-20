/** A shared range policy for imported originals and version-bound recordings. */
export function rangedResponse(size: number, type: string, range: string | null,
  open: (start: number, end: number) => BodyInit, cache = "no-store") {
  let start = 0, end = size - 1;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    const unsatisfied = () => new Response(null, { status: 416, headers: { "Content-Range": "bytes */" + size } });
    if (!match || (!match[1] && !match[2])) return unsatisfied();
    start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
    end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    if (start > end || start >= size) return unsatisfied();
  }
  const headers = new Headers({ "Content-Type": type, "Content-Length": String(end - start + 1),
    "Accept-Ranges": "bytes", "Cache-Control": cache, "X-Content-Type-Options": "nosniff" });
  if (range) headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  return new Response(size ? open(start, end) : null, { status: range ? 206 : 200, headers });
}
