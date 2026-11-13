/* eslint-disable @next/next/no-img-element */
import type { EditionSummary } from '@/lib/types';

const toneFor = (e: EditionSummary, i: number) =>
  e.status === 'upcoming' ? ' soon' : ['', ' teal', ' purple', ''][i % 4];

export default function Shelf({ editions }: { editions: EditionSummary[] }) {
  return (
    <section className="sec" id="shelf" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <div className="sec-head">
          <div>
            <span className="tagbar">ALL EDITIONS</span>
            <h2 className="display">The shelf.</h2>
          </div>
          <p className="sub">Every issue, readable online, games included.</p>
        </div>
        <div className="shelf">
          {editions.map((e, i) => (
            <a className="issue" key={e.slug} href={`#${e.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>
              <div className={`cv${e.cover ? '' : toneFor(e, i)}`}>
                {e.cover ? (
                  <img src={e.cover} alt={`${e.month} cover`} />
                ) : (
                  <>
                    {e.label && <span className="label" style={{ fontSize: 12 }}>{e.label}</span>}
                    <span className="display">{e.subtitle?.split(' · ')[0] ?? e.month}</span>
                    {e.subtitle?.includes(' · ') && (
                      <span style={{ fontWeight: 700, fontSize: 13, textAlign: 'center' }}>{e.subtitle.split(' · ')[1]}</span>
                    )}
                  </>
                )}
              </div>
              <p>{e.month}<small>{e.title}</small></p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
