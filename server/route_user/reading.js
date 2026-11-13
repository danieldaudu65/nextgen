const express = require('express');
const article = require('../models/article');
const readProgress = require('../models/readProgress');
const student = require('../models/student');
const auth = require('../middleware/auth');
const { POINTS, MISSION_TARGET } = require('../config/rules');
const { dayKey } = require('../utils/dates');
const { awardPoints } = require('../services/points');
const { studentSummary } = require('../services/summary');
const { getSettings, readSecondsFor } = require('../services/settings');
const { questionState, gradeAnswer, publicQuestion } = require('../services/readCheck');
const { hasAccess } = require('../services/access');
const router = express.Router();

const MAX_HEADSTART = 60 * 60; // a guest's reading before they logged in counts for up to 1 hour


// ============================================================
// READING HEARTBEAT
// POST /user_reading/progress  { edition, article, activeSeconds, scrollDepth, startedAt? }
// ============================================================
//
// The website sends this every ~10s while a student is reading, and once
// more when the reading time is reached. When the story crosses the line
// (Admin → Settings → Reading, default 2 minutes) we:
//   1. give the reading points (once)
//   2. count it toward today's Reading Mission (3 stories = bonus)
//   3. tell the website the story question is ready (if the story has one)
// startedAt: when the page opened. Lets a guest who logs in at the end
// keep the time they already spent reading (capped at 1 hour).
// ============================================================
router.post('/progress', auth, async (req, res) => {
    try {
        const { edition: editionSlug, article: articleSlug, activeSeconds, scrollDepth, startedAt } = req.body;

        if (!editionSlug || !articleSlug) {
            return res.status(400).json({ success: false, message: 'edition and article are required' });
        }

        const story = await article.findOne({ slug: articleSlug }, 'readMins question').lean();
        if (!story) {
            return res.status(404).json({ success: false, message: 'Article not found' });
        }
        const settings = await getSettings();
        const need = readSecondsFor(settings, story.readMins);

        const prev = (await readProgress.findOne({ student: req.user._id, article: articleSlug }).lean()) || {};
        const now = new Date();

        // The browser can lie, so never accept more reading time than real time has passed
        let firstSeenAt = prev.firstSeenAt ? new Date(prev.firstSeenAt) : now;
        const claimedStart = startedAt ? new Date(startedAt) : null;
        if (claimedStart && !Number.isNaN(claimedStart.getTime()) && claimedStart < firstSeenAt && (now - claimedStart) / 1000 <= MAX_HEADSTART) {
            firstSeenAt = claimedStart;
        }
        const elapsed = (now - firstSeenAt) / 1000 + 15;
        const active = Math.round(Math.max(prev.activeSeconds || 0, Math.min(Math.max(0, Number(activeSeconds) || 0), elapsed)));
        const maxScroll = Math.min(1, Math.max(prev.maxScroll || 0, Number(scrollDepth) || 0));
        const completed = Boolean(prev.completed) || active >= need;
        const justCompleted = completed && !prev.completed;
        const today = dayKey();

        await readProgress.updateOne(
            { student: req.user._id, article: articleSlug },
            {
                $set: {
                    edition: editionSlug, firstSeenAt, activeSeconds: active, maxScroll, completed,
                    ...(justCompleted ? { completedAt: now, completedDay: today } : {}),
                },
            },
            { upsert: true }
        );

        // Reading points once the time is reached. Asked again on later visits too, so someone who
        // got access afterwards (school code, payment) still gets them; the ledger stops doubles.
        const earned = [];
        let locked = false;
        if (completed) {
            const pts = settings.reading.readPoints ?? POINTS.READ_STORY;
            const reward = await awardPoints(req.user, 'READ_STORY', `${editionSlug}:${articleSlug}`, pts, { edition: editionSlug, settings });
            locked = reward.locked;
            if (reward.awarded) {
                earned.push({ label: 'Story read', points: pts });
                reward.bonus.forEach((b) => earned.push({ label: 'Streak bonus', points: b.points }));
            }

            if (reward.awarded) {
                const readsToday = await readProgress.countDocuments({ student: req.user._id, completedDay: today });
                if (readsToday >= MISSION_TARGET) {
                    const fresh = await student.findById(req.user._id);
                    const mission = await awardPoints(fresh, 'READING_MISSION', today, POINTS.READING_MISSION, { edition: editionSlug, settings });
                    if (mission.awarded) earned.push({ label: 'Reading Mission complete', points: POINTS.READING_MISSION });
                }
            }
        }

        const hasQuestion = Boolean(publicQuestion(story.question));
        const user = await student.findById(req.user._id);
        return res.status(200).json({
            success: true,
            progress: { activeSeconds: active, scrollDepth: maxScroll, completed, needSeconds: need },
            question: hasQuestion ? questionState(prev, settings.reading) : null,
            earned,
            locked,
            user: await studentSummary(user),
        });
    } catch (error) {
        console.error('Reading progress error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ============================================================
// START THE STORY QUESTION (starts the timer)
// POST /user_reading/question/start  { article }
// ============================================================
router.post('/question/start', auth, async (req, res) => {
    try {
        const slug = String(req.body.article || '');
        const story = await article.findOne({ slug, status: 'published' }, 'question edition').lean();
        const q = publicQuestion(story?.question);
        if (!q) return res.status(404).json({ success: false, message: 'This story has no question' });

        const settings = await getSettings();
        if (settings.access.requireAccessForPoints && !hasAccess(req.user)) {
            return res.status(403).json({ success: false, code: 'NO_ACCESS', message: 'Get NextGen access (school code or your own plan) to answer and earn points.' });
        }
        const prog = await readProgress.findOne({ student: req.user._id, article: slug }).lean();
        if (!prog?.completed) return res.status(400).json({ success: false, message: 'Read the story first 📖' });

        const state = questionState(prog, settings.reading);
        if (state.status === 'done') return res.status(200).json({ success: true, state, question: null });
        if (state.status === 'out') return res.status(200).json({ success: true, state, question: null, message: 'No tries left for this story' });

        // Already running (page refresh): continue the same timer
        if (state.status === 'open') return res.status(200).json({ success: true, state, question: q, seconds: settings.reading.questionSeconds });

        // New try: if the last one was never answered, it timed out
        await readProgress.updateOne(
            { _id: prog._id },
            {
                $set: { qStartedAt: new Date(), qAnsweredAt: null, ...(prog.qStartedAt && !prog.qAnsweredAt ? { qLastResult: 'timeout' } : {}) },
                $inc: { qAttempts: 1 },
            }
        );
        const fresh = await readProgress.findById(prog._id).lean();
        return res.status(200).json({ success: true, state: questionState(fresh, settings.reading), question: q, seconds: settings.reading.questionSeconds });
    } catch (error) {
        console.error('Question start error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ============================================================
// ANSWER THE STORY QUESTION
// POST /user_reading/question/answer  { article, choice }
// ============================================================
router.post('/question/answer', auth, async (req, res) => {
    try {
        const slug = String(req.body.article || '');
        const story = await article.findOne({ slug, status: 'published' }, 'question edition').lean();
        if (!publicQuestion(story?.question)) return res.status(404).json({ success: false, message: 'This story has no question' });

        const settings = await getSettings();
        const prog = await readProgress.findOne({ student: req.user._id, article: slug }).lean();
        const graded = gradeAnswer(prog || {}, story.question, req.body.choice, settings.reading);
        if (!graded.ok) return res.status(400).json({ success: false, message: graded.reason, state: graded.state });

        await readProgress.updateOne(
            { _id: prog._id, qAnsweredAt: null },
            { $set: { qAnsweredAt: new Date(), qLastResult: graded.result, ...(graded.correct ? { qDone: true } : {}) } }
        );

        let awarded = 0;
        let locked = false;
        if (graded.correct) {
            const reward = await awardPoints(req.user, 'READ_QUESTION', `${story.edition}:${slug}`, settings.reading.questionPoints, { edition: story.edition, settings });
            awarded = reward.awarded;
            locked = reward.locked;
        }
        const user = await student.findById(req.user._id);
        return res.status(200).json({
            success: true,
            correct: graded.correct,
            triesLeft: graded.triesLeft,
            explain: story.question.explain || '',
            // only reveal the right answer when there are no tries left
            answer: graded.correct || graded.triesLeft === 0 ? story.question.answer : null,
            awarded,
            locked,
            user: await studentSummary(user),
        });
    } catch (error) {
        console.error('Question answer error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
