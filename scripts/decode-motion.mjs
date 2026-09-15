/** Exact decode for this repository's video-only Chromium VP8/WebM captures.
 * HTML video seeking/presentation may skip frames during PNG readback.
 * WebCodecs decodes actual encoded timestamps without a playback clock.
 * Reject other codecs/lacing instead of guessing poses.
 * Format: https://www.webmproject.org/docs/container/
 */
export async function decodeMotion({ bytes, times }) {
  if (!globalThis.VideoDecoder)
    throw Error('QA requires WebCodecs in a secure browser context');
  const data = new Uint8Array(bytes),
    chunks = [];
  let scale = 1000000,
    codec = '';
  const vint = (p, id = false) => {
    if (!data[p]) throw Error('Invalid EBML integer');
    let n = 1;
    while (!(data[p] & (1 << (8 - n)))) n++;
    let value = id ? data[p] : data[p] & ((1 << (8 - n)) - 1);
    let unknown = !id && value === (1 << (8 - n)) - 1;
    for (let i = 1; i < n; i++) {
      value = value * 256 + data[p + i];
      unknown &&= data[p + i] === 255;
    }
    return { value, n, unknown };
  };
  const uint = (a, b) => {
    let n = 0;
    for (; a < b; a++) n = n * 256 + data[a];
    return n;
  };
  const parents = new Set([
    0x18538067, 0x1549a966, 0x1654ae6b, 0xae, 0x1f43b675, 0xa0,
  ]);
  const scan = (p, end, clusterTime = 0) => {
    while (p < end) {
      const tag = vint(p, true),
        size = vint(p + tag.n);
      const start = p + tag.n + size.n,
        stop = size.unknown ? end : start + size.value;
      if (stop > end || stop <= p) throw Error('Invalid EBML element size');
      if (parents.has(tag.value)) scan(start, stop, clusterTime);
      else if (tag.value === 0x2ad7b1) scale = uint(start, stop);
      else if (tag.value === 0x86)
        codec = new TextDecoder().decode(data.subarray(start, stop));
      else if (tag.value === 0xe7) clusterTime = uint(start, stop);
      else if (tag.value === 0xa1 || tag.value === 0xa3) {
        const track = vint(start),
          p = start + track.n;
        if (track.value !== 1 || data[p + 2] & 6)
          throw Error('QA expects one unlaced video track');
        const relative = new DataView(data.buffer).getInt16(p);
        const packet = data.subarray(p + 3, stop);
        chunks.push({
          timestamp: Math.round(((clusterTime + relative) * scale) / 1000),
          type: packet[0] & 1 ? 'delta' : 'key',
          data: packet,
        });
      }
      p = stop;
    }
  };
  scan(0, data.length);
  if (codec !== 'V_VP8' || !chunks.length) throw Error('QA expects VP8/WebM');
  const chosen = times.map((time) => {
    if (!Number.isFinite(time) || time < 0)
      throw Error('Invalid requested frame');
    const chunk = chunks.reduce((a, b) =>
      Math.abs(a.timestamp / 1e6 - time) <= Math.abs(b.timestamp / 1e6 - time)
        ? a
        : b,
    );
    if (Math.abs(chunk.timestamp / 1e6 - time) > 0.075)
      throw Error(`Encoded frame gap at ${time}s`);
    return { time, timestamp: chunk.timestamp };
  });
  const wanted = new Set(chosen.map((c) => c.timestamp)),
    images = new Map();
  let decodeError;
  const decoder = new VideoDecoder({
    error: (error) => {
      decodeError = error;
    },
    output: (frame) => {
      try {
        if (wanted.has(frame.timestamp)) {
          const c = document.createElement('canvas');
          c.width = frame.displayWidth;
          c.height = frame.displayHeight;
          c.getContext('2d').drawImage(frame, 0, 0);
          images.set(frame.timestamp, c.toDataURL('image/png').split(',')[1]);
        }
      } finally {
        frame.close();
      }
    },
  });
  try {
    decoder.configure({ codec: 'vp8' });
    for (const chunk of chunks) decoder.decode(new EncodedVideoChunk(chunk));
    await decoder.flush();
    if (decodeError) throw decodeError;
    return chosen.map((c) => {
      const png = images.get(c.timestamp);
      if (!png) throw Error(`Missing decoded frame ${c.timestamp}`);
      return { time: c.time, decodedTime: c.timestamp / 1e6, png };
    });
  } finally {
    if (decoder.state !== 'closed') decoder.close();
  }
}
