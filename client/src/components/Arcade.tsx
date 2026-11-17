import type { Debate, Edition } from '@/lib/types';
import WorldTeaser from './world/WorldTeaser';
import EnterWorldButton from './world/EnterWorldButton';
import '@/app/arcade/arcade.css';

// Homepage section for NextGen World. The full 3D island and its 7 levels live on /arcade
// (components/world/WorldPage.tsx). The old 3 game cards are in components/games/ (still used by the world).
// `debate` is kept so app/page.tsx does not need to change.
export default function Arcade({ edition }: { edition: Edition; debate?: Debate | null }){
  return (
    <section className="sec" id="arcade">
      <div className="wrap">
        <div className="sec-head wt-head">
          <div>
            <span className="tagbar">NextGen World · {edition.month} Island</span>
            <h2 className="display">Tap in. Level up.</h2>
            <p className="sub">7 levels from this edition on one island. Win stars and points, climb the road, and beat the Boss to open the next island.</p>
          </div>
          <EnterWorldButton />
        </div>
        <WorldTeaser edition={edition} />
      </div>
    </section>
  );
}
