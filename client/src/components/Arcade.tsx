import type { Debate, Edition } from '@/lib/types';
import { Icon } from './Icon';
import MoneyGame from './games/MoneyGame';
import QuizGame from './games/QuizGame';
import DebateVote from './games/DebateVote';
import GameLock from './games/GameLock';

// Homepage shows 3 games. The rest (SortGame, PromiseChecker, WordSearchGame)
// are ready in components/games/ for the full Arcade page.
export default function Arcade({ edition, debate }: { edition: Edition; debate: Debate }) {
  return (
    <section className="sec arcade" id="arcade">
      <div className="wrap">
        <div className="sec-head">
          <div>
            <span className="tagbar">CRACK THIS ARCADE</span>
            <h2 className="display">Read it. Then play it.</h2>
          </div>
          <p className="sub">Every game comes from a story in this edition. Try them, they work.</p>
        </div>
        {/* Only members (school code or own package) can play: see GameLock */}
        <GameLock>
          <div className="games">
            <MoneyGame money={edition.money} edition={edition.slug} />
            <QuizGame slug={edition.slug} questions={edition.quiz} />
            <DebateVote debate={debate} />
          </div>
        </GameLock>
        <div className="more">
          <span>More in the arcade</span>
          <a href="#"><Icon name="robot" />Cheat Code or Study Buddy?</a>
          <a href="#"><Icon name="ballot" />Promise Checker</a>
          <a href="#"><Icon name="puzzle" />Crossword &amp; Word Search</a>
        </div>
      </div>
    </section>
  );
}
