/*
 * ============================================================
 * The question at the end of every story (pure logic, easy to test)
 * ============================================================
 * After the reading time, the reader gets the story's question with a
 * timer (default 60s). Right answer = question points. Wrong answer,
 * timeout or leaving the page uses the try; they get `retries` more tries.
 *
 * Saved on readProgress:
 *   qAttempts     tries started
 *   qStartedAt    when the current try started
 *   qDone         answered correctly (no more tries)
 *   qLastResult   'correct' | 'wrong' | 'timeout'
 * ============================================================
 */

const GRACE = 5; // seconds of network slack

// Where is this reader with the question?
function questionState(progress = {}, { questionSeconds, retries }, now = new Date()) {
    const attempts = progress.qAttempts || 0;
    const maxTries = 1 + retries;
    if (progress.qDone) return { status: 'done', attempts, triesLeft: 0 };
    const started = progress.qStartedAt ? new Date(progress.qStartedAt) : null;
    const open = started && !progress.qAnsweredAt && (now - started) / 1000 <= questionSeconds + GRACE;
    if (open) return { status: 'open', attempts, triesLeft: maxTries - attempts, secondsLeft: Math.max(0, Math.ceil(questionSeconds - (now - started) / 1000)) };
    if (attempts >= maxTries) return { status: 'out', attempts, triesLeft: 0 };
    return { status: 'ready', attempts, triesLeft: maxTries - attempts };
}

// Grade an answer for the current try
function gradeAnswer(progress, question, choice, settings, now = new Date()) {
    const state = questionState(progress, settings, now);
    if (state.status !== 'open') return { ok: false, reason: state.status === 'done' ? 'Already answered' : 'Time is up for this try', state };
    const correct = Number(choice) === Number(question.answer);
    const triesLeft = correct ? 0 : state.triesLeft; // tries not started yet
    return { ok: true, correct, result: correct ? 'correct' : 'wrong', triesLeft };
}

// The question as the reader sees it (never the answer)
const publicQuestion = (q) => (q && q.prompt && Array.isArray(q.options) && q.options.length >= 2 ? { prompt: q.prompt, options: q.options } : null);

// A question is usable when it has a prompt, 2–4 options and a valid answer
function validQuestion(q) {
    if (!q || !String(q.prompt || '').trim()) return null;
    const options = (Array.isArray(q.options) ? q.options : []).map((o) => String(o || '').trim()).filter(Boolean).slice(0, 4);
    const answer = Number(q.answer);
    if (options.length < 2 || !Number.isInteger(answer) || answer < 0 || answer >= options.length) return null;
    return { prompt: String(q.prompt).trim().slice(0, 300), options: options.map((o) => o.slice(0, 160)), answer, explain: String(q.explain || '').trim().slice(0, 300) };
}

module.exports = { GRACE, questionState, gradeAnswer, publicQuestion, validQuestion };
