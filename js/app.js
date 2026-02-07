// ===== State Management =====
const state = {
    currentSection: 'vocabulary',
    vocabulary: {
        level: 'beginner',
        currentIndex: 0,
        isFlipped: false
    },
    quiz: {
        questions: [],
        currentIndex: 0,
        score: 0,
        answered: false,
        totalQuestions: 10
    },
    sentences: {
        level: 'beginner',
        currentIndex: 0
    },
    stats: loadStats()
};

function loadStats() {
    const saved = localStorage.getItem('englishLearningStats');
    if (saved) {
        return JSON.parse(saved);
    }
    return {
        knownWords: {},
        unknownWords: {},
        quizResults: [],
        totalQuizCorrect: 0,
        totalQuizAnswered: 0,
        history: [],
        lastStudyDate: null,
        streak: 0
    };
}

function saveStats() {
    localStorage.setItem('englishLearningStats', JSON.stringify(state.stats));
}

function updateStreak() {
    const today = new Date().toISOString().split('T')[0];
    if (state.stats.lastStudyDate === today) return;

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (state.stats.lastStudyDate === yesterday) {
        state.stats.streak++;
    } else if (state.stats.lastStudyDate !== today) {
        state.stats.streak = 1;
    }
    state.stats.lastStudyDate = today;
    saveStats();
}

function addHistory(action, result, isGood) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('ko-KR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    state.stats.history.unshift({ date: dateStr, action, result, isGood });
    if (state.stats.history.length > 20) {
        state.stats.history = state.stats.history.slice(0, 20);
    }
    saveStats();
}

// ===== Navigation =====
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const section = btn.dataset.section;
        switchSection(section);
    });
});

function switchSection(sectionId) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));

    document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');
    document.getElementById(sectionId).classList.add('active');
    state.currentSection = sectionId;

    if (sectionId === 'stats') {
        renderStats();
    }
}

// ===== Vocabulary (Flashcard) =====
const flashcard = document.getElementById('flashcard');
const cardWord = document.getElementById('card-word');
const cardPhonetic = document.getElementById('card-phonetic');
const cardMeaning = document.getElementById('card-meaning');
const cardExample = document.getElementById('card-example');
const cardCounter = document.getElementById('card-counter');

function getCurrentVocabList() {
    return VOCABULARY[state.vocabulary.level] || [];
}

function renderFlashcard() {
    const list = getCurrentVocabList();
    if (list.length === 0) return;

    const item = list[state.vocabulary.currentIndex];
    cardWord.textContent = item.word;
    cardPhonetic.textContent = item.phonetic;
    cardMeaning.textContent = item.meaning;
    cardExample.textContent = item.example;
    cardCounter.textContent = `${state.vocabulary.currentIndex + 1} / ${list.length}`;

    flashcard.classList.remove('flipped');
    state.vocabulary.isFlipped = false;
}

flashcard.addEventListener('click', () => {
    flashcard.classList.toggle('flipped');
    state.vocabulary.isFlipped = !state.vocabulary.isFlipped;
});

document.getElementById('btn-prev').addEventListener('click', () => {
    const list = getCurrentVocabList();
    state.vocabulary.currentIndex = (state.vocabulary.currentIndex - 1 + list.length) % list.length;
    renderFlashcard();
});

document.getElementById('btn-next').addEventListener('click', () => {
    const list = getCurrentVocabList();
    state.vocabulary.currentIndex = (state.vocabulary.currentIndex + 1) % list.length;
    renderFlashcard();
});

document.getElementById('btn-known').addEventListener('click', () => {
    const list = getCurrentVocabList();
    const item = list[state.vocabulary.currentIndex];
    const key = `${state.vocabulary.level}_${item.word}`;
    state.stats.knownWords[key] = true;
    delete state.stats.unknownWords[key];
    updateStreak();
    addHistory('단어 학습', `"${item.word}" 알고 있음`, true);
    saveStats();

    state.vocabulary.currentIndex = (state.vocabulary.currentIndex + 1) % list.length;
    renderFlashcard();
});

document.getElementById('btn-unknown').addEventListener('click', () => {
    const list = getCurrentVocabList();
    const item = list[state.vocabulary.currentIndex];
    const key = `${state.vocabulary.level}_${item.word}`;
    state.stats.unknownWords[key] = true;
    delete state.stats.knownWords[key];
    updateStreak();
    addHistory('단어 학습', `"${item.word}" 모름`, false);
    saveStats();

    state.vocabulary.currentIndex = (state.vocabulary.currentIndex + 1) % list.length;
    renderFlashcard();
});

// Level selector for vocabulary
document.querySelectorAll('.level-btn:not(.sentence-level)').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.level-btn:not(.sentence-level)').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.vocabulary.level = btn.dataset.level;
        state.vocabulary.currentIndex = 0;
        renderFlashcard();
    });
});

// ===== Quiz =====
const quizWord = document.getElementById('quiz-word');
const quizOptions = document.getElementById('quiz-options');
const quizFeedback = document.getElementById('quiz-feedback');
const quizNextBtn = document.getElementById('quiz-next-btn');
const quizScore = document.getElementById('quiz-score');
const quizProgress = document.getElementById('quiz-progress');
const quizContainer = document.querySelector('.quiz-container');
const quizResult = document.getElementById('quiz-result');

function generateQuiz() {
    const allWords = [
        ...VOCABULARY.beginner,
        ...VOCABULARY.intermediate,
        ...VOCABULARY.advanced
    ];

    const shuffled = shuffleArray([...allWords]);
    state.quiz.questions = shuffled.slice(0, state.quiz.totalQuestions).map(q => {
        const wrongOptions = shuffleArray(allWords.filter(w => w.word !== q.word))
            .slice(0, 3)
            .map(w => w.meaning);
        const options = shuffleArray([q.meaning, ...wrongOptions]);
        return { ...q, options, correctAnswer: q.meaning };
    });
    state.quiz.currentIndex = 0;
    state.quiz.score = 0;
    state.quiz.answered = false;

    quizContainer.style.display = 'block';
    quizResult.style.display = 'none';

    renderQuizQuestion();
}

function renderQuizQuestion() {
    const q = state.quiz.questions[state.quiz.currentIndex];
    quizWord.textContent = q.word;
    quizScore.textContent = `점수: ${state.quiz.score}`;
    quizProgress.textContent = `${state.quiz.currentIndex + 1} / ${state.quiz.totalQuestions}`;
    quizFeedback.textContent = '';
    quizFeedback.className = 'quiz-feedback';
    quizNextBtn.style.display = 'none';
    state.quiz.answered = false;

    quizOptions.innerHTML = '';
    q.options.forEach(option => {
        const btn = document.createElement('button');
        btn.className = 'quiz-option';
        btn.textContent = option;
        btn.addEventListener('click', () => handleQuizAnswer(btn, option, q));
        quizOptions.appendChild(btn);
    });
}

function handleQuizAnswer(btn, selected, question) {
    if (state.quiz.answered) return;
    state.quiz.answered = true;

    const isCorrect = selected === question.correctAnswer;

    document.querySelectorAll('.quiz-option').forEach(opt => {
        opt.classList.add('disabled');
        if (opt.textContent === question.correctAnswer) {
            opt.classList.add('correct');
        }
    });

    if (isCorrect) {
        state.quiz.score++;
        quizFeedback.textContent = '정답입니다!';
        quizFeedback.className = 'quiz-feedback correct';
        state.stats.totalQuizCorrect++;
    } else {
        btn.classList.add('wrong');
        quizFeedback.textContent = `오답! 정답: ${question.correctAnswer}`;
        quizFeedback.className = 'quiz-feedback wrong';
    }

    state.stats.totalQuizAnswered++;
    updateStreak();
    saveStats();

    quizScore.textContent = `점수: ${state.quiz.score}`;

    if (state.quiz.currentIndex < state.quiz.totalQuestions - 1) {
        quizNextBtn.style.display = 'block';
    } else {
        setTimeout(showQuizResult, 1500);
    }
}

quizNextBtn.addEventListener('click', () => {
    state.quiz.currentIndex++;
    renderQuizQuestion();
});

function showQuizResult() {
    quizContainer.style.display = 'none';
    quizResult.style.display = 'block';

    const percent = Math.round((state.quiz.score / state.quiz.totalQuestions) * 100);
    document.getElementById('result-score').textContent = `${state.quiz.score} / ${state.quiz.totalQuestions}`;
    document.getElementById('result-detail').textContent = `정답률: ${percent}%`;

    const isGood = percent >= 70;
    addHistory('퀴즈', `${state.quiz.score}/${state.quiz.totalQuestions} (${percent}%)`, isGood);
}

document.getElementById('quiz-restart').addEventListener('click', generateQuiz);

// Start quiz when section becomes visible
const quizNavBtn = document.querySelector('[data-section="quiz"]');
quizNavBtn.addEventListener('click', () => {
    if (state.quiz.questions.length === 0) {
        generateQuiz();
    }
});

// ===== Sentences =====
const sentenceKorean = document.getElementById('sentence-korean');
const sentenceEnglish = document.getElementById('sentence-english');
const sentenceInput = document.getElementById('sentence-input');
const sentenceFeedback = document.getElementById('sentence-feedback');
const sentenceCounter = document.getElementById('sentence-counter');
const hintText = document.getElementById('hint-text');

function getCurrentSentenceList() {
    return SENTENCES[state.sentences.level] || [];
}

function renderSentence() {
    const list = getCurrentSentenceList();
    if (list.length === 0) return;

    const item = list[state.sentences.currentIndex];
    sentenceKorean.textContent = item.korean;
    sentenceEnglish.textContent = item.english;
    sentenceCounter.textContent = `${state.sentences.currentIndex + 1} / ${list.length}`;

    sentenceInput.value = '';
    sentenceFeedback.textContent = '';
    sentenceFeedback.className = 'sentence-feedback';
    hintText.textContent = '';
}

document.getElementById('sentence-check').addEventListener('click', checkSentence);
sentenceInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') checkSentence();
});

function checkSentence() {
    const list = getCurrentSentenceList();
    const item = list[state.sentences.currentIndex];
    const userAnswer = sentenceInput.value.trim().toLowerCase();
    const correctAnswer = item.answer.toLowerCase();

    if (!userAnswer) return;

    if (userAnswer === correctAnswer) {
        sentenceFeedback.textContent = '정답입니다!';
        sentenceFeedback.className = 'sentence-feedback correct';
        updateStreak();
        addHistory('문장 학습', `"${item.answer}" 정답`, true);
    } else {
        sentenceFeedback.textContent = `오답! 정답: ${item.answer}`;
        sentenceFeedback.className = 'sentence-feedback wrong';
        addHistory('문장 학습', `"${item.answer}" 오답`, false);
    }
    saveStats();
}

document.getElementById('sentence-hint').addEventListener('click', () => {
    const list = getCurrentSentenceList();
    const item = list[state.sentences.currentIndex];
    hintText.textContent = item.hint;
});

document.getElementById('sentence-prev').addEventListener('click', () => {
    const list = getCurrentSentenceList();
    state.sentences.currentIndex = (state.sentences.currentIndex - 1 + list.length) % list.length;
    renderSentence();
});

document.getElementById('sentence-next').addEventListener('click', () => {
    const list = getCurrentSentenceList();
    state.sentences.currentIndex = (state.sentences.currentIndex + 1) % list.length;
    renderSentence();
});

// Level selector for sentences
document.querySelectorAll('.sentence-level').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.sentence-level').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.sentences.level = btn.dataset.level;
        state.sentences.currentIndex = 0;
        renderSentence();
    });
});

// ===== Stats =====
function renderStats() {
    const allLevels = ['beginner', 'intermediate', 'advanced'];
    let totalStudied = 0;
    let totalKnown = 0;

    allLevels.forEach(level => {
        const words = VOCABULARY[level];
        let knownCount = 0;
        words.forEach(w => {
            const key = `${level}_${w.word}`;
            if (state.stats.knownWords[key]) knownCount++;
            if (state.stats.knownWords[key] || state.stats.unknownWords[key]) totalStudied++;
        });
        totalKnown += knownCount;

        const percent = words.length > 0 ? Math.round((knownCount / words.length) * 100) : 0;
        const progressEl = document.getElementById(`progress-${level}`);
        const percentEl = document.getElementById(`percent-${level}`);
        if (progressEl) progressEl.style.width = `${percent}%`;
        if (percentEl) percentEl.textContent = `${percent}%`;
    });

    document.getElementById('stat-total-words').textContent = totalStudied;
    document.getElementById('stat-known-words').textContent = totalKnown;

    const quizAccuracy = state.stats.totalQuizAnswered > 0
        ? Math.round((state.stats.totalQuizCorrect / state.stats.totalQuizAnswered) * 100)
        : 0;
    document.getElementById('stat-quiz-accuracy').textContent = `${quizAccuracy}%`;
    document.getElementById('stat-streak').textContent = `${state.stats.streak}일`;

    // Render history
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = '';
    if (state.stats.history.length === 0) {
        historyList.innerHTML = '<div class="history-item"><span class="history-action">아직 학습 기록이 없습니다.</span></div>';
    } else {
        state.stats.history.forEach(h => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `
                <span class="history-date">${h.date}</span>
                <span class="history-action">${h.action}</span>
                <span class="history-result ${h.isGood ? 'good' : 'bad'}">${h.result}</span>
            `;
            historyList.appendChild(div);
        });
    }
}

document.getElementById('reset-stats').addEventListener('click', () => {
    if (confirm('모든 학습 통계를 초기화하시겠습니까?')) {
        state.stats = {
            knownWords: {},
            unknownWords: {},
            quizResults: [],
            totalQuizCorrect: 0,
            totalQuizAnswered: 0,
            history: [],
            lastStudyDate: null,
            streak: 0
        };
        saveStats();
        renderStats();
    }
});

// ===== Utility =====
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ===== Initialize =====
renderFlashcard();
renderSentence();
