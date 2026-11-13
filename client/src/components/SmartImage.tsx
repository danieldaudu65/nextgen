'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type CSSProperties } from 'react';

export type ImageFit = 'auto' | 'cover' | 'contain';

/**
 * A picture that looks right in a box of any shape, whatever shape the picture is.
 *
 * fit="auto" (default) compares the picture's shape with the box's shape:
 *  - close enough → the picture FILLS the box (cropped a little, around `position`)
 *  - very different (e.g. a tall phone photo in a wide box) → the WHOLE picture shows,
 *    sitting on a blurred copy of itself so there are no empty bars
 * fit="cover" always fills, fit="contain" always shows the whole picture.
 *
 * The parent decides the box size (height/aspect-ratio); this fills it.
 */
export default function SmartImage({
  src, alt = '', position, fit = 'auto', align = 'center', tolerance = 0.45, className = '', style,
}: {
  src: string;
  alt?: string;
  /** focus point when the picture is cropped, e.g. "50% 30%" */
  position?: string | null;
  fit?: ImageFit | null;
  /** where a whole (contained) picture sits, e.g. "right center" on the homepage hero */
  align?: string;
  /** how different the shapes can be before switching to "whole picture" (ln of the ratio) */
  tolerance?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [picRatio, setPicRatio] = useState<number | null>(null);
  const [boxRatio, setBoxRatio] = useState<number | null>(null);

  // measure the box (and again when the screen size changes)
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width && r.height) setBoxRatio(r.width / r.height);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // measure the picture (also covers pictures that loaded before React was ready)
  useEffect(() => {
    setPicRatio(null);
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth) setPicRatio(img.naturalWidth / img.naturalHeight);
  }, [src]);

  const chosen = fit && fit !== 'auto'
    ? fit
    : picRatio && boxRatio && Math.abs(Math.log(picRatio / boxRatio)) > tolerance ? 'contain' : 'cover';

  return (
    <span ref={boxRef} className={`smart-img ${chosen} ${className}`.trim()} style={style}>
      {chosen === 'contain' && <img className="smart-img-bg" src={src} alt="" aria-hidden="true" />}
      <img
        ref={imgRef}
        className="smart-img-main"
        src={src}
        alt={alt}
        style={{ objectPosition: chosen === 'contain' ? align : (position || 'center') }}
        onLoad={(e) => {
          const i = e.currentTarget;
          if (i.naturalWidth) setPicRatio(i.naturalWidth / i.naturalHeight);
        }}
      />
    </span>
  );
}

/** For pictures inside a story (gallery, inline images): always the whole picture, at its own shape. */
export function FramedImage({ src, alt = '' }: { src: string; alt?: string }) {
  return (
    <span className="framed-img">
      <img className="framed-img-bg" src={src} alt="" aria-hidden="true" />
      <img className="framed-img-main" src={src} alt={alt} loading="lazy" />
    </span>
  );
}
