'use client';

import type { ReactNode } from 'react';
import SmartImage, { FramedImage } from '../SmartImage';
import type { Photos, Profile } from './layoutLines';

/** Two photos overlapping like the print magazine. 1 photo → framed, 3+ → a photo grid. */
export function PhotoCollage({ images, caption, className = '' }: Photos & { className?: string }) {
  if (images.length === 1) {
    return <figure className={`story-inline-image ${className}`}><FramedImage src={images[0]} alt={caption ?? ''} />{caption && <figcaption>{caption}</figcaption>}</figure>;
  }
  if (images.length >= 3) {
    return (
      <figure className={`story-mosaic n${Math.min(images.length, 6)} ${className}`}>
        <div>{images.slice(0, 6).map((src, i) => <span key={`${src}-${i}`}><SmartImage src={src} alt="" fit="cover" /></span>)}</div>
        {caption && <figcaption>{caption}</figcaption>}
      </figure>
    );
  }
  return (
    <figure className={`story-collage ${className}`}>
      <div className="collage-frame">
        <span className="collage-a"><SmartImage src={images[0]} alt="" position="center 25%" tolerance={0.6} /></span>
        <span className="collage-b"><SmartImage src={images[1]} alt="" position="center 25%" tolerance={0.6} /></span>
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

/** Profile card: photos, yellow name banner with age, tags, then the profile's own text */
export function ProfileCard({ profile, children }: { profile: Profile; children: ReactNode }) {
  return (
    <article className="profile-card">
      {profile.images.length > 0 && <PhotoCollage images={profile.images.slice(0, 2)} className="profile-photos" />}
      <div className="profile-name">
        <span>{profile.name}</span>
        {profile.age && <b className="profile-age" aria-label={`Age ${profile.age}`}>{profile.age}</b>}
      </div>
      {profile.tags && <p className="profile-tags">{profile.tags.replace(/\s*·\s*/g, ' | ')}</p>}
      <div className="profile-text">{children}</div>
    </article>
  );
}
