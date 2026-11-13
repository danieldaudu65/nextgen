import { Logo } from './Logo';

export default function Footer() {
  return (
    <footer id="about">
      <div className="wrap">
        <div className="foot">
          <div>
            <Logo onDark size="lg" />
            <div className="tln">Think · <span>Learn</span> · Navigate</div>
            <p style={{ fontSize: 14, lineHeight: 1.5 }}>
              News &amp; interactive learning for Nigeria&apos;s next generation. Published by Punch Nigeria Limited, publishers of The Punch Newspaper.
            </p>
          </div>
          <div><h5>Read</h5><a href="#">The Big News</a><a href="#">Pop Culture</a><a href="#">Tech Pulse</a><a href="#">Money Matters</a><a href="#">NextGen Stars</a></div>
          <div><h5>Play</h5><a href="/#arcade">Crack This</a><a href="/#arcade">Daily Quiz</a><a href="#">Fact or Cap?</a><a href="/#arcade">Debate</a><a href="/#leaders">Leaderboard</a></div>
          <div><h5>For Schools &amp; Brands</h5><a href="/schools/guide">School Guide</a><a href="/schools">School Showcase</a><a href="/nominate">Nominate a Star</a><a href="/school/login">School login</a><a href="#">Advertise with us</a><a href="#">contact@punchnextgen.com</a></div>
        </div>
        <div className="copy"><span>© {new Date().getFullYear()} NextGen · ISSN 3121-7206</span><span>Built by DerikWebX</span></div>
      </div>
    </footer>
  );
}
