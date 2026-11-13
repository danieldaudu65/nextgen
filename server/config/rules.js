/*
 * ============================================================
 * Game rules - all the numbers in one place
 * ============================================================
 * Change points or reading rules here, nowhere else.
 * ============================================================
 */

const TIMEZONE = 'Africa/Lagos';

const POINTS = {
    READ_STORY: 5,         // reading a story for the set time (see Admin → Settings)
    READ_QUESTION: 5,      // answering the story's question correctly
    READING_MISSION: 20,   // bonus for finishing MISSION_TARGET stories in one day
    QUIZ_CORRECT: 10,      // per correct quiz answer (once per question)
    DEBATE_VOTE: 20,       // once per debate
    STREAK_BONUS_3: 15,    // reaching a 3-day streak
    STREAK_BONUS_7: 50,    // reaching a 7-day streak
};

// Points for finishing each mini-game (once per game per edition)
const GAME_POINTS = {
    money: 40,
    sort: 25,
    promise: 20,
    wordsearch: 30,
    crossword: 30,
};

const MISSION_TARGET = 3; // stories per day for the Reading Mission

// When does a story count as "read"?
const READ_RULES = {
    minScrollDepth: 0.7,   // reached 70% of the story
    minSeconds: 20,        // at least 20s of active reading...
    secondsPerMinute: 0.3, // ...or 30% of the estimated read time, whichever is longer
    heartbeatSlack: 15,    // seconds of clock slack allowed between heartbeats
};

// Actions that count for the "Top Readers" board (everything counts for "Top Players")
const READING_ACTIONS = ['READ_STORY', 'READ_QUESTION', 'READING_MISSION'];

module.exports = { TIMEZONE, POINTS, GAME_POINTS, MISSION_TARGET, READ_RULES, READING_ACTIONS };
