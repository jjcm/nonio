// A ratio-locked box for post media, shared by soci-image and soci-video.
//
// Post media always arrives in two passes (thumbnail then full image, poster
// then video). Sizing the box from whichever bitmap happens to be decoded
// resizes the media area mid-load, which shifts everything below it. The frame
// instead takes its size from the aspect ratio alone, so both passes lay out
// identically and the swap is invisible.
//
// Consumers set --media-max-width and --media-max-height on their host to
// whatever bounds that surface wants, and stack their sources as children of
// #frame.
export const MEDIA_FRAME_CSS = `
  #frame {
    position: relative;
    margin: 0 auto;
    /* Height comes from the ratio, so the box is final before any bytes land.
       Width is additionally capped by the ratio against the height bound,
       otherwise a portrait ratio would reserve a box wider than the media and
       letterbox it. Both stay unset until a real ratio is known -- guessing one
       would trade a late shift for a wrong box. */
    aspect-ratio: var(--media-ratio);
    width: min(var(--media-max-width), calc(var(--media-ratio) * var(--media-max-height)));
    max-height: var(--media-max-height);

    > * {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
  }
`

// Lock the frame to width/height, ignoring the zeroes and nulls that stand in
// for "unknown" in post data. Returns whether a ratio is now set, so callers can
// tell a stored ratio from one that still has to be measured off a bitmap.
export function lockRatio(host, width, height){
  if(width > 0 && height > 0){
    host.style.setProperty('--media-ratio', width / height)
    host.toggleAttribute('ratio', true)
  }
  return host.hasAttribute('ratio')
}
