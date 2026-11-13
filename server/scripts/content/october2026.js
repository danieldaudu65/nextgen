// Content for the October 2026 edition (used by scripts/seed.js).
// Demo edition used by the optional database seed; it is not a client-side fallback.

const october2026 = {
  slug: 'oct-2026',
  title: 'Nigeria 2027 Loading…',
  month: 'Oct 2026',
  volume: 'Vol 4 No 1',
  status: 'current',
  cover: '/images/cover-oct-2026.jpg',
  tagline: 'Tap in. Level up ⚡',
  headline: ['Nigeria', '2027'],
  headlineAccent: 'Loading…',
  lede: "Candidates. Campaigns. Plans & promises. Here's what YOU need to know — politics 101, NextGen style. No big grammar.",
  electionDate: '2027-01-16T08:00:00+01:00',
  ticker: [
    { tag: 'BIG NEWS', text: 'Presidential & National Assembly elections — Sat 16 Jan 2027' },
    { tag: 'BIG NEWS', text: 'Governorship & State Assembly elections — Sat 6 Feb 2027' },
    { tag: 'NEXTGEN STARS', text: 'Daniella scored 372/400 in UTME 2026 🔥' },
    { tag: 'CRACK THIS', text: 'New crossword: The Star Code' },
    { tag: 'DEBATE', text: 'Big promises or clear plans? Cast your vote' },
  ],
  sections: [
    { key: 'big-news', featured: true, label: 'THE BIG NEWS', pages: 'p.2–3', title: 'Nigeria 2027 Loading…', blurb: "What's an election? Promise vs plan. Meet INEC, the election referee. And why it matters even if you're not 18 yet.", genz: 'Politics 101 — NextGen style', image: '/images/kids.jpg', variant: 'big', href: '/articles/whats-an-election' },
    { key: 'money', featured: true, label: 'MONEY MATTERS', pages: 'p.7', title: 'The ₦10K Money Mystery', blurb: '₦10K on Monday. ₦650 by Friday. Who ate your money?', image: '/images/money.jpg', tone: 'yellow', href: '/articles/the-10k-money-mystery' },
    { key: 'tech', featured: true, label: 'TECH PULSE', pages: 'p.6', title: 'AI: Study Buddy or Cheat Code?', image: '/images/ai.jpg', tone: 'blue', href: '/articles/ai-study-buddy-or-cheat-code' },
    { key: 'pop', label: 'POP CULTURE', pages: 'p.4–5', title: 'Drip Check & All Eyez On', blurb: 'Matching prints. Individual energy.', genz: 'Eating up. Zero crumbs.', icon: 'shades', tone: 'pink', href: '/articles/drip-check-all-eyez-on' },
    { key: 'stars', label: 'NEXTGEN STARS', pages: 'p.8–9', title: '3 Stars. 3 Lessons.', blurb: 'The Fencer, the Innovator and the Scholar. Bravery, curiosity, smart habits.', icon: 'trophy', tone: 'purple', href: '/articles/three-stars-three-lessons' },
    { key: 'toons', featured: true, label: 'SMARTTOONS', pages: 'p.11', title: 'Promise or Plan? The Comic', blurb: '8 panels. One question: who actually has a plan?', genz: 'Swipe panel by panel →', image: '/images/toon.jpg', href: '#' },
    { key: 'crack', featured: true, label: 'CRACK THIS', pages: 'p.12–13', title: 'Crossword & Word Search', image: '/images/jayzo.jpg', imagePosition: 'center 10%', href: '/#arcade' },
    { key: 'vocab', label: 'VOCAB VAULT', pages: 'p.14–15', title: 'Election Words, Made Simple', blurb: "Explain like I'm 10.", icon: 'book', href: '/#vocab' },
    { key: 'debate', label: 'DEBATE', pages: 'p.16', title: 'Big Promises or Clear Plans?', blurb: 'Team A vs Team B. Which comes first? Pick a side and say why.', genz: '+20 pts for voting', image: '/images/debgirl.jpg', variant: 'full', tone: 'yellow', href: '/#arcade' },
  ],
  vocab: [
    { word: 'Electorate', category: 'Election words', definition: 'All the people who are eligible to vote in an election.', nextgen: 'One person = a voter. All voters = the electorate.' },
    { word: 'Manifesto', category: 'Election words', definition: 'A document explaining what a party or candidate plans to do if elected.', nextgen: 'NextGen translation: their government TO-DO list.' },
    { word: 'Incumbent', category: 'Election words', definition: 'The person who already holds a particular political office.', nextgen: 'Basically: they already have the job.' },
    { word: 'Policy', category: 'Election words', definition: 'A plan, rule or approach for dealing with a particular issue or problem.', nextgen: 'Good policies turn promises into progress.' },
    { word: 'Épée', category: 'Star words', definition: 'One of the three weapons used in fencing. In épée, the whole body counts as a target.', nextgen: 'Pronounced EH-pay. French for "sword".', aliases: ['epee'] },
    { word: 'Prototype', category: 'Star words', definition: 'An early model of something, built so it can be tested and improved.', nextgen: 'Version 1.0, before all the upgrades.' },
    { word: 'Resilience', category: 'Star words', definition: 'The ability to keep going and succeed, even when things get difficult.', nextgen: 'Daniella topped UTME with determination and resilience.' },
    { word: 'INEC', category: 'Acronyms', definition: 'The Independent National Electoral Commission: the election referee that registers voters, sets up polling units and announces results.', nextgen: 'The referee. They make sure every vote counts.' },
    { word: 'PVC', category: 'Acronyms', definition: "Permanent Voter's Card: the card you need to vote in Nigeria.", nextgen: 'Your PVC is your power. Get informed. Get ready.' },
  ],
  quiz: [
    { id: 'q1', question: 'Daniella scored 372 out of 400 in UTME. What percentage is that?', options: ['83%', '88%', '93%', '97%'], answer: 2 },
    { id: 'q2', question: "Oghenegaren won Nigeria's gold in which fencing weapon?", options: ['Foil', 'Sabre', 'Épée', 'Karate (plot twist!)'], answer: 2 },
    { id: 'q3', question: 'Which is the smartest way to use AI for school?', options: ['Copy the full answer and submit it', 'Ask it to explain a hard topic, then write your own answer', 'Let it do every assignment'], answer: 1 },
  ],
  sort: [
    { text: 'Copy-paste the whole homework answer', answer: 'cheat' },
    { text: "Ask AI to explain photosynthesis like you're 13", answer: 'buddy' },
    { text: '"Give me 3 quiz questions on this topic"', answer: 'buddy' },
    { text: 'Let AI write your essay and hand it in', answer: 'cheat' },
    { text: 'Ask AI to review your draft and give feedback', answer: 'buddy' },
  ],
  promiseQuestions: [
    'What exactly are you promising?', 'How are you going to do it?', 'How much will it cost?',
    'Where will the money come from?', 'When will it happen?', 'Is this realistic?', 'Is it even your job?',
  ],
  money: {
    start: 10000,
    save: 2000,
    items: [
      { label: '🌯 Shawarma', price: 2500 }, { label: '📶 Data bundle', price: 1500 },
      { label: '🥤 Zobo', price: 500 }, { label: '🍪 Snacks', price: 800 },
      { label: '🚌 Transport', price: 1200 }, { label: '🎮 Game top-up', price: 2000 },
      { label: '📱 Airtime', price: 850 }, { label: '🍦 Ice cream', price: 1000 },
    ],
  },
  wordSearch: {
    grid: ['VOTERXPLA', 'BALLOTQNM', 'ZINECKPVC', 'POLICYDUE', 'CAMPAIGNW', 'MRPLANJOK', 'HELECTION', 'TUPROMISE', 'QDEMOCRAY'],
    words: ['VOTER', 'BALLOT', 'INEC', 'PVC', 'POLICY', 'CAMPAIGN', 'PLAN', 'ELECTION', 'PROMISE'],
  },
};

const editions = [
  { slug: 'oct-2026', title: 'Nigeria 2027 Loading…', month: 'Oct 2026', status: 'current', cover: '/images/cover-oct-2026.jpg' },
  { slug: 'nov-2026', title: 'Stay tuned… 2027 is loading', month: 'Nov 2026', status: 'upcoming', label: 'NEXT EDITION', subtitle: 'Part 2 · Meet the candidates' },
  { slug: 'sports-2', title: 'Sports Edition 2', month: 'Mar 2026', status: 'archive', label: 'SPORTS EDITION', subtitle: 'No. 2' },
];

const debate = {
  id: 'offline-debate',
  question: 'Big promises or clear plans: which comes first?',
  teamA: { label: 'TEAM A · CLEAR PLANS', pitch: "Show us how. Tell us what it'll cost and where the money comes from." },
  teamB: { label: 'TEAM B · BIG GOALS', pitch: 'Think bigger! Describe the future first, then build the details.' },
  votesA: 698,
  votesB: 506,
  imageA: '/images/debgirl.jpg',
  imageB: '/images/debboy.jpg',
};

module.exports = { october2026, editions, debate };
