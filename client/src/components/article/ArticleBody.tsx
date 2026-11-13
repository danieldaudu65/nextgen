'use client';

import type { ReactNode } from 'react';
import type { VocabWord } from '@/lib/types';
import VocabText from '../VocabText';
import { FramedImage } from '../SmartImage';
import { parsePhotos, segment } from './layoutLines';
import { PhotoCollage, ProfileCard } from './LayoutBlocks';

// Renders story blocks:
//   "text"        → paragraph
//   "## Heading"  → heading, "### Subheading" → smaller heading
//   "> Callout"   → highlighted box
//   "- item"      → bullet (consecutive bullets become one list), "1. item" → numbered list
//   "![caption](url)"            → a picture
//   "@photos url | url | caption" → photos overlapping like the magazine
//   "@profile Name | 14 | Tags | url | url" → profile card (see layoutLines.ts)
export default function ArticleBody({ blocks, vocab, open, setOpen }: {
  blocks: string[]; vocab: VocabWord[]; open: string | null; setOpen: (w: string | null) => void;
}) {
  const text = (t: string) => <VocabText text={t} vocab={vocab} open={open} setOpen={setOpen} />;

  // Normal lines → elements (keyPrefix keeps React keys unique between groups)
  const renderBlocks = (lines: string[], keyPrefix: string) => {
    const out: ReactNode[] = [];
    let list: string[] = [];
    let ordered: string[] = [];
    const flushList = (key: number) => {
      if (!list.length) return;
      out.push(<ul key={`${keyPrefix}ul-${key}`}>{list.map((li, i) => <li key={i}>{text(li)}</li>)}</ul>);
      list = [];
    };
    const flushOrdered = (key: number) => {
      if (!ordered.length) return;
      out.push(<ol key={`${keyPrefix}ol-${key}`}>{ordered.map((li, i) => <li key={i}>{text(li)}</li>)}</ol>);
      ordered = [];
    };
    lines.forEach((b, i) => {
      const k = `${keyPrefix}${i}`;
      if (b.startsWith('- ')) { flushOrdered(i); list.push(b.slice(2)); return; }
      if (/^\d+\. /.test(b)) { flushList(i); ordered.push(b.replace(/^\d+\. /, '')); return; }
      flushList(i);
      flushOrdered(i);
      const image = b.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      const photos = parsePhotos(b);
      if (photos) out.push(<PhotoCollage key={k} {...photos} />);
      else if (image && /^(https?:\/\/|\/)/i.test(image[2])) out.push(<figure className="story-inline-image" key={k}><FramedImage src={image[2]} alt={image[1]} />{image[1] && <figcaption>{image[1]}</figcaption>}</figure>);
      else if (b.trim() === '---') out.push(<hr key={k} className="story-rule" />);
      else if (b.startsWith('## ')) out.push(<h2 key={k}>{b.slice(3)}</h2>);
      else if (b.startsWith('### ')) out.push(<h3 key={k}>{b.slice(4)}</h3>);
      else if (b.startsWith('> ')) out.push(<aside key={k} className="callout">{text(b.slice(2))}</aside>);
      else out.push(<p key={k}>{text(b)}</p>);
    });
    flushList(lines.length);
    flushOrdered(lines.length + 1);
    return out;
  };

  return (
    <div className="story-body">
      {segment(blocks).map((seg, si) =>
        seg.kind === 'blocks'
          ? renderBlocks(seg.blocks, `s${si}-`)
          : (
            <div key={`s${si}`} className={`profile-grid${seg.items.length === 1 ? ' single' : ''}`}>
              {seg.items.map((item, pi) => (
                <ProfileCard key={`${item.profile.name}-${pi}`} profile={item.profile}>
                  {renderBlocks(item.blocks, `s${si}-p${pi}-`)}
                </ProfileCard>
              ))}
            </div>
          ),
      )}
    </div>
  );
}
