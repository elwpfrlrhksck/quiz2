// ========================================================================
// (1) 로컬 스토리지 관리 함수 (진행 상황 저장 및 불러오기)
// ========================================================================
// 순차 풀이 진행 상황 저장 (카테고리 키: 인덱스)
let sequentialProgress = {
    'diesel_engine': 0,
    'diesel_electric_equipment': 0,
    'diesel_electric_circuit': 0,
    'diesel_braking': 0,
    'rail_track': 0,
    'rail_signal': 0,
    'rail_catenary': 0,
    'rail_vehicle': 0,
    'rail_communication': 0
};

function saveProgress() {
    localStorage.setItem('quizProgress', JSON.stringify(sequentialProgress));
}

function loadProgress() {
    const saved = localStorage.getItem('quizProgress');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            // 기존 구조와 병합하여 로드 (새 카테고리 추가 대비)
            Object.keys(sequentialProgress).forEach(key => {
                if (parsed.hasOwnProperty(key)) {
                    sequentialProgress[key] = parsed[key];
                }
            });
        } catch (e) {
            console.error("Failed to parse sequential progress from localStorage", e);
        }
    }
}

// 초기 실행 시 진행 상황 불러오기
loadProgress();

// ========================================================================
// (2) 전역 변수 (상태 관리)
// ========================================================================
let currentMode = 'menu'; // menu, practice_setup, test_setup, practice_run, test_run, results
let practicePool = []; // 연습 모드용 문제 배열
let testQuestions = []; // 시험 모드용 문제 배열
let userAnswers = []; // 시험 모드용 사용자 답안 배열
let currentQuestionIndex = 0;
let score = 0;

// 풀이 모드 및 현재 풀이 카테고리 관리
let practiceMode = 'random'; // random, sequential
let currentPracticeCategories = []; // 현재 풀이 중인 카테고리 배열 (순차 풀이 시 사용)

// 카테고리 이름 매핑
const categoryNames = {
    'diesel_engine': '디젤-기관',
    'diesel_electric_equipment': '디젤-전기-장치',
    'diesel_electric_circuit': '디젤-전기-회로',
    'diesel_braking': '디젤-제동',
    'rail_track': '시스템-선로',
    'rail_signal': '시스템-신호',
    'rail_catenary': '시스템-전차선',
    'rail_vehicle': '시스템-차량',
    'rail_communication': '시스템-통신'
};

// DOM 요소 캐싱 (자주 사용하는 요소)
const allScreens = document.querySelectorAll('.screen');
const menuScreen = document.getElementById('menu-screen');
const practiceSetupScreen = document.getElementById('practice-setup-screen');
const testSetupScreen = document.getElementById('test-setup-screen');
const quizScreen = document.getElementById('quiz-screen');
const resultsScreen = document.getElementById('results-screen');

const quizTitle = document.getElementById('quiz-title');
const progressTracker = document.getElementById('progress-tracker');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');

const practiceFeedback = document.getElementById('practice-feedback');
const feedbackMessage = document.getElementById('feedback-message');
const explanationDiv = document.getElementById('explanation');
const explanationText = document.getElementById('explanation-text');

const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const submitBtn = document.getElementById('submit-btn');
const nextPracticeBtn = document.getElementById('next-practice-btn');
const quitBtn = document.getElementById('quit-btn');

const scoreDisplay = document.getElementById('score-display');
const percentageDisplay = document.getElementById('percentage-display');
const resultsDisplayContainer = document.getElementById('results-display-container');


// ========================================================================
// (3) 핵심 로직: 화면 전환
// ========================================================================

function showScreen(screenId) {
    allScreens.forEach(screen => {
        screen.classList.add('hidden', 'opacity-0');
    });
    const targetScreen = document.getElementById(screenId);
    targetScreen.classList.remove('hidden');
    // A slight delay to allow the 'hidden' class to be removed before fading in
    setTimeout(() => targetScreen.classList.remove('opacity-0'), 20);
}

// 전역 스코프에 함수 노출 (HTML onclick에서 호출 가능하도록)
window.goToMenu = () => {
    currentMode = 'menu';
    showScreen('menu-screen');
    // 모든 상태 초기화
    practicePool = [];
    testQuestions = [];
    userAnswers = [];
    currentQuestionIndex = 0;
    score = 0;
    practiceMode = 'random';
    currentPracticeCategories = [];
    // 결과 표시 컨테이너 비우기
    resultsDisplayContainer.innerHTML = '';
    // 진행 상황 저장 (안전하게)
    saveProgress();
}

// ========================================================================
// (4) 핵심 로직: 연습 모드
// ========================================================================
window.showPracticeSetup = () => {
    currentMode = 'practice_setup';
    // 체크박스 초기화
    document.querySelectorAll('.category-check').forEach(cb => cb.checked = false);
    showScreen('practice-setup-screen');
}

/**
 * 랜덤 연습 모드 시작
 */
window.startPracticeRandom = (isAll) => {
    practicePool = [];
    currentPracticeCategories = [];
    practiceMode = 'random'; // 랜덤 모드 설정

    let targetCategories = [];
    if (isAll) {
        targetCategories = Object.keys(allQuestions);
    } else {
        const selectedChecks = document.querySelectorAll('.category-check:checked');
        if (selectedChecks.length === 0) {
            alert('하나 이상의 과목을 선택하세요.');
            return;
        }
        targetCategories = Array.from(selectedChecks).map(cb => cb.value);
    }

    targetCategories.forEach(key => {
        if (allQuestions[key]) {
            practicePool = practicePool.concat(allQuestions[key]);
        }
    });

    if (practicePool.length === 0) {
        alert('선택한 과목에 문제가 없습니다. (데이터를 추가해주세요)');
        return;
    }

    currentMode = 'practice_run';
    shuffleArray(practicePool); // 문제 풀 섞기
    currentQuestionIndex = 0;
    setupQuizScreen('practice', 'random'); // 랜덤 모드로 설정
    loadPracticeQuestion();
    showScreen('quiz-screen');
}

/**
 * 순서대로 풀기 (이어서 풀기) 모드 시작
 * (수정): 문제를 다 푼 카테고리의 경우, 진행 상황을 0으로 리셋하고 처음부터 다시 풀도록 로직 변경
 */
window.startPracticeSequential = (isAll) => {
    practicePool = [];
    currentPracticeCategories = [];
    practiceMode = 'sequential'; // 순차 모드 설정

    let targetCategories = [];
    if (isAll) {
        targetCategories = Object.keys(allQuestions);
    } else {
        const selectedChecks = document.querySelectorAll('.category-check:checked');
        if (selectedChecks.length === 0) {
            alert('하나 이상의 과목을 선택하세요.');
            return;
        }
        targetCategories = Array.from(selectedChecks).map(cb => cb.value);
    }

    // 선택한 카테고리 저장 (진행상황 업데이트 시 필요)
    currentPracticeCategories = targetCategories;

    targetCategories.forEach(key => {
        if (allQuestions[key] && allQuestions[key].length > 0) {
            let startIndex = sequentialProgress[key] || 0; // 저장된 진행상황 로드
            
            // (수정) 만약 저장된 진행 상황이 총 문제 수와 같거나 크다면 (즉, 다 풀었다면)
            if (startIndex >= allQuestions[key].length) {
                startIndex = 0; // 처음부터 다시 시작
                sequentialProgress[key] = 0; // 진행 상황도 0으로 리셋
            }
            
            // startIndex부터 끝까지 문제 추출
            const questions = allQuestions[key].slice(startIndex); 
            practicePool = practicePool.concat(questions); // 순서대로 추가
        }
    });

    // (수정) 리셋된 진행 상황이 있을 수 있으므로 여기서 저장
    saveProgress();

    if (practicePool.length === 0) {
        // (수정) 문제를 다 푼 경우가 아니라, 정말 문제가 없는 경우의 메시지로 변경
        alert('선택한 과목에 문제가 없습니다. (데이터를 확인해주세요)');
        return;
    }

    currentMode = 'practice_run';
    // ★ 순차 모드이므로 shuffleArray(practicePool)를 호출하지 않음 ★
    currentQuestionIndex = 0;
    setupQuizScreen('practice', 'sequential'); // 순차 모드로 설정
    loadPracticeQuestion();
    showScreen('quiz-screen');
}


function loadPracticeQuestion() {
    // 피드백/해설 숨기기 및 버튼 활성화
    practiceFeedback.classList.add('hidden');
    explanationDiv.classList.add('hidden');
    nextPracticeBtn.classList.add('hidden');

    // (추가) practicePool이 비어있는 예외 처리 (만약을 대비)
    if (!practicePool || practicePool.length === 0 || currentQuestionIndex >= practicePool.length) {
        console.error("loadPracticeQuestion: 문제가 없습니다.");
        alert("문제를 불러오는 데 실패했습니다. 메뉴로 돌아갑니다.");
        goToMenu();
        return;
    }
    
    const q = practicePool[currentQuestionIndex];
    
    if (practiceMode === 'sequential') {
         const totalRemaining = practicePool.length;
         quizTitle.innerText = `연속 풀이 모드 (${currentQuestionIndex + 1} / ${totalRemaining})`;
    }

    questionText.innerText = q.question;
    optionsContainer.innerHTML = ''; // 기존 옵션 삭제

    q.options.forEach((option, index) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn border border-gray-300 p-4 rounded-lg text-left text-lg hover:bg-gray-100 transition-colors';
        btn.innerHTML = `<span class="font-medium mr-2">${index + 1}.</span> ${option}`;
        btn.onclick = () => checkPracticeAnswer(index, q.answer);
        optionsContainer.appendChild(btn);
    });

    // (수정) 이전 버튼 활성화/비활성화
    prevBtn.disabled = (currentQuestionIndex === 0);
}

function checkPracticeAnswer(selectedIndex, correctIndex) {
    // (수정) 이미 답을 확인했으면(피드백이 보이면) 함수를 즉시 종료
    if (!practiceFeedback.classList.contains('hidden')) {
        return;
    }

    const optionButtons = optionsContainer.querySelectorAll('.option-btn');
    optionButtons.forEach(btn => btn.disabled = true); // 버튼 비활성화

    if (selectedIndex === correctIndex) {
        feedbackMessage.innerText = '정답입니다!';
        feedbackMessage.className = 'text-2xl font-bold mb-4 text-green-600';
        optionButtons[selectedIndex].classList.add('correct');
    } else {
        feedbackMessage.innerText = '오답입니다.';
        feedbackMessage.className = 'text-2xl font-bold mb-4 text-red-600';
        optionButtons[selectedIndex].classList.add('incorrect');
        optionButtons[correctIndex].classList.add('correct');
    }
    
    if (practiceMode === 'sequential') {
        const q = practicePool[currentQuestionIndex];
        
        for (const key of currentPracticeCategories) {
            const categoryQuestions = allQuestions[key];
            
            if (categoryQuestions) {
                // (수정) q.question이 null이 아닌지 확인
                const foundIndex = categoryQuestions.findIndex(item => item && item.question === q.question);
                
                if (foundIndex !== -1) {
                    if (foundIndex + 1 > (sequentialProgress[key] || 0)) {
                         sequentialProgress[key] = foundIndex + 1;
                         saveProgress(); // 로컬 스토리지에 저장
                    }
                    break;
                }
            }
        }
    }

    explanationText.innerText = practicePool[currentQuestionIndex].explanation;
    explanationDiv.classList.remove('hidden');
    practiceFeedback.classList.remove('hidden');
    nextPracticeBtn.classList.remove('hidden');
    
    // (수정) Enter 키로 다음 문제로 넘어갈 수 있도록 포커스 이동 (선택 사항)
    nextPracticeBtn.focus();
}

/**
 * (수정) 순차 풀이 시, 마지막 문제에서 메뉴로 돌아가도록 메시지 수정
 */
window.nextPracticeQuestion = () => {
    currentQuestionIndex++;
    
    if (currentQuestionIndex >= practicePool.length) {
        if (practiceMode === 'sequential') {
            // (수정) 메시지를 좀 더 명확하게 변경
            alert('이번 세션의 모든 문제를 풀었습니다. 메뉴로 돌아갑니다.');
            goToMenu(); // goToMenu()가 내부적으로 saveProgress()를 호출하여 완료된 상태를 저장합니다.
            return;
        }
        
        // (랜덤 모드 로직)
        shuffleArray(practicePool);
        currentQuestionIndex = 0;
        alert('모든 문제를 다 풀었습니다. 다시 랜덤으로 시작합니다.');
    }
    loadPracticeQuestion();
}

// ========================================================================
// (5) 핵심 로직: 시험 모드
// ========================================================================
window.showTestSetup = () => {
    currentMode = 'test_setup';
    showScreen('test-setup-screen');
}

window.startTest = (testType) => {
    testQuestions = [];
    const dieselCategories = ['diesel_engine', 'diesel_electric_equipment', 'diesel_electric_circuit', 'diesel_braking'];
    const railCategories = ['rail_track', 'rail_signal', 'rail_catenary', 'rail_vehicle', 'rail_communication'];

    let requiredQuestions = 0;

    if (testType === 'diesel') {
        requiredQuestions = 40;
        testQuestions = getShuffledQuestions(dieselCategories, requiredQuestions);
    } else if (testType === 'rail') {
        requiredQuestions = 20;
        testQuestions = getShuffledQuestions(railCategories, requiredQuestions);
    } else if (testType === 'full') {
        requiredQuestions = 60;
        const dieselQs = getShuffledQuestions(dieselCategories, 40);
        const railQs = getShuffledQuestions(railCategories, 20);
        testQuestions = dieselQs.concat(railQs);
        
        if(testQuestions.length < requiredQuestions) {
             console.warn(`전체 시험 문제 수 부족. (요청: 60, 가능: ${testQuestions.length})`);
             requiredQuestions = testQuestions.length;
        }
        shuffleArray(testQuestions);
    }

    if (testQuestions.length === 0) {
         alert('시험 문제를 생성할 수 없습니다. (데이터를 추가해주세요)');
         return;
    }
    
    if (testQuestions.length < requiredQuestions) {
        alert(`문제가 부족하여 ${testQuestions.length} 문제로 시험을 시작합니다. (요청: ${requiredQuestions} 문제)`);
    }

    currentMode = 'test_run';
    userAnswers = new Array(testQuestions.length).fill(-1);
    currentQuestionIndex = 0;
    score = 0;
    setupQuizScreen('test');
    loadTestQuestion();
    showScreen('quiz-screen');
}

function loadTestQuestion() {
    progressTracker.innerText = `${currentQuestionIndex + 1} / ${testQuestions.length}`;
    const q = testQuestions[currentQuestionIndex];
    questionText.innerText = q.question;
    optionsContainer.innerHTML = '';
    const savedAnswer = userAnswers[currentQuestionIndex];

    q.options.forEach((option, index) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn border border-gray-300 p-4 rounded-lg text-left text-lg hover:bg-gray-100 transition-colors';
        btn.innerHTML = `<span class="font-medium mr-2">${index + 1}.</span> ${option}`;
        btn.onclick = () => selectTestAnswer(index);
        if(index === savedAnswer) btn.classList.add('selected');
        optionsContainer.appendChild(btn);
    });

    prevBtn.disabled = (currentQuestionIndex === 0);
    nextBtn.classList.toggle('hidden', currentQuestionIndex === testQuestions.length - 1);
    submitBtn.classList.toggle('hidden', currentQuestionIndex !== testQuestions.length - 1);
}

window.selectTestAnswer = (selectedIndex) => {
    userAnswers[currentQuestionIndex] = selectedIndex;
    const optionButtons = optionsContainer.querySelectorAll('.option-btn');
    optionButtons.forEach((btn, index) => {
        btn.classList.toggle('selected', index === selectedIndex);
    });
}

/**
 * (수정) 함수명을 navigateTest -> navigateQuiz로 변경
 * (수정) 연습 모드(practice_run)일 때 이전 버튼(-1) 로직 추가
 */
window.navigateQuiz = (direction) => {
    if (currentMode === 'test_run') {
        // --- 시험 모드 로직 ---
        currentQuestionIndex += direction;
        if (currentQuestionIndex < 0) currentQuestionIndex = 0;
        if (currentQuestionIndex >= testQuestions.length) currentQuestionIndex = testQuestions.length - 1;
        loadTestQuestion();
    } else if (currentMode === 'practice_run' && direction === -1) {
        // --- 연습 모드 로직 (이전 버튼) ---
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            loadPracticeQuestion();
        }
    }
}

window.submitTest = () => {
    const unanwsered = userAnswers.indexOf(-1);
    if (unanwsered !== -1) {
        if (!confirm(`아직 풀지 않은 문제(${unanwsered + 1}번)가 있습니다. 그대로 제출하시겠습니까?`)) {
            currentQuestionIndex = unanwsered;
            loadTestQuestion();
            return;
        }
    }
    
    score = 0;
    for(let i = 0; i < testQuestions.length; i++) {
        if(userAnswers[i] === testQuestions[i].answer) {
            score++;
        }
    }

    currentMode = 'results';
    scoreDisplay.innerText = `${score} / ${testQuestions.length}`;
    const percentage = (score / testQuestions.length * 100).toFixed(1);
    percentageDisplay.innerText = `(${percentage}%)`;
    
    resultsDisplayContainer.innerHTML = '';
    showScreen('results-screen');
}

// ========================================================================
// (6) 핵심 로직: 결과 보기
// ========================================================================
window.showResults = (filter) => {
    resultsDisplayContainer.innerHTML = '';

    testQuestions.forEach((q, index) => {
        const userAnswer = userAnswers[index];
        const isCorrect = (userAnswer === q.answer);

        if (filter === 'incorrect' && isCorrect) {
            return;
        }

        const resultDiv = document.createElement('div');
        resultDiv.className = `p-4 border rounded-lg ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`;
        
        let optionsHtml = q.options.map((option, optIndex) => {
            let classes = 'p-3 rounded-lg mt-2';
            if (optIndex === q.answer) {
                classes += ' bg-green-100 font-bold text-green-800'; // 정답
            } else if (optIndex === userAnswer && !isCorrect) {
                classes += ' bg-red-100 line-through text-red-800'; // 사용자의 오답
            } else {
                classes += ' bg-gray-50';
            }
            return `<div class="${classes}">${optIndex + 1}. ${option}</div>`;
        }).join('');

        resultDiv.innerHTML = `
            <p class="text-lg font-semibold mb-3">Q ${index + 1}. ${q.question}</p>
            <div class="space-y-2">${optionsHtml}</div>
            <div class="mt-4 pt-4 border-t border-gray-200">
                <h4 class="font-semibold text-gray-800">해설:</h4>
                <p class="text-gray-700">${q.explanation}</p>
            </div>
        `;
        resultsDisplayContainer.appendChild(resultDiv);
    });

    if (resultsDisplayContainer.innerHTML === '') {
        resultsDisplayContainer.innerHTML = '<p class="text-center text-lg text-gray-500 py-4">틀린 문제가 없습니다! 완벽합니다. 🥳</p>';
    }
}


// ========================================================================
// (7) 유틸리티 함수
// ========================================================================

/** * 퀴즈 화면 UI를 모드에 맞게 설정
 * (수정) 연습 모드에서도 prevBtn을 표시하도록 변경
 */
function setupQuizScreen(mode, practiceMode = 'random') {
    if (mode === 'practice') {
        if (practiceMode === 'sequential') {
            quizTitle.innerText = '연속 풀이 모드 (순서대로)';
        } else {
            quizTitle.innerText = '연습 모드 (랜덤)';
        }
        
        progressTracker.classList.add('hidden');
        practiceFeedback.classList.add('hidden');
        nextPracticeBtn.classList.add('hidden');
        prevBtn.classList.remove('hidden'); // (수정) 이전 버튼 표시
        nextBtn.classList.add('hidden');
        submitBtn.classList.add('hidden');
        quitBtn.innerText = '연습 종료';
    } else { // test
        quizTitle.innerText = '시험 모드';
        progressTracker.classList.remove('hidden');
        practiceFeedback.classList.add('hidden');
        nextPracticeBtn.classList.add('hidden');
        prevBtn.classList.remove('hidden');
        nextBtn.classList.remove('hidden');
        submitBtn.classList.remove('hidden');
        quitBtn.innerText = '시험 포기';
    }
}

/** 배열 무작위 섞기 (Fisher-Yates Shuffle) */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

/** 지정된 카테고리에서 지정된 수만큼 문제 랜덤 추출 (시험 모드용) */
function getShuffledQuestions(categories, count) {
    let pool = [];
    for (const cat of categories) {
        if (allQuestions[cat]) {
            pool = pool.concat(allQuestions[cat]);
        } else {
            console.warn(`'${cat}' 카테고리에 문제가 없습니다.`);
        }
    }
    shuffleArray(pool);
    
    if (pool.length < count) {
        console.warn(`요청된 문제 수(${count})보다 풀의 문제 수(${pool.length})가 적습니다.`);
    }
    return pool.slice(0, count);
}

// ========================================================================
// (8) (수정) 키보드 이벤트 핸들러
// ========================================================================

document.addEventListener('keydown', (event) => {
    // 텍스트 입력 필드 등에서 키 입력을 방지하기 위함
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
    }

    if (currentMode === 'practice_run') {
        handlePracticeKeys(event);
    } else if (currentMode === 'test_run') {
        handleTestKeys(event);
    } else if (currentMode === 'results') {
        handleResultsKeys(event);
    }
});

function handlePracticeKeys(event) {
    // 피드백이 보이는지(답을 확인했는지) 여부
    const feedbackVisible = !practiceFeedback.classList.contains('hidden');

    if (feedbackVisible) {
        // 피드백이 보이면 Enter 키로 다음 문제로 넘어감
        if (event.key === 'Enter') {
            event.preventDefault();
            nextPracticeQuestion();
        }
    } else {
        // 피드백이 안 보이면(문제 푸는 중) 1~4 키로 답 선택
        switch (event.key) {
            case '1':
            case '2':
            case '3':
            case '4':
                event.preventDefault();
                const index = parseInt(event.key) - 1;
                const q = practicePool[currentQuestionIndex];
                if (q && index < q.options.length) {
                    checkPracticeAnswer(index, q.answer);
                }
                break;
            // (수정) 연습 모드에서 'ArrowLeft' (왼쪽 화살표) 키로 이전 문제 이동
            case 'ArrowLeft':
                event.preventDefault();
                navigateQuiz(-1);
                break;
        }
    }
}

function handleTestKeys(event) {
    switch (event.key) {
        case '1':
        case '2':
        case '3':
        case '4':
            event.preventDefault();
            const index = parseInt(event.key) - 1;
            const q = testQuestions[currentQuestionIndex];
            if (q && index < q.options.length) {
                selectTestAnswer(index);
            }
            break;
        case 'Enter':
            event.preventDefault();
            const isLastQuestion = (currentQuestionIndex === testQuestions.length - 1);
            if (isLastQuestion) {
                // 마지막 문제에서는 Enter로 제출
                submitTest();
            } else {
                // 다음 문제로 이동
                navigateQuiz(1); // (수정) navigateTest -> navigateQuiz
            }
            break;
        // (수정) 시험 모드에서 화살표 키로 탐색
        case 'ArrowLeft':
            event.preventDefault();
            navigateQuiz(-1);
            break;
        case 'ArrowRight':
            event.preventDefault();
            // 마지막 문제가 아닐 때만 다음 문제로 이동
            if (currentQuestionIndex < testQuestions.length - 1) {
                navigateQuiz(1);
            }
            break;
    }
}

function handleResultsKeys(event) {
    // 결과 화면에서 Enter 키를 누르면 메뉴로
    if (event.key === 'Enter') {
        event.preventDefault();
        goToMenu();
    }
}


// ========================================================================
// (9) 초기 실행
// ========================================================================
goToMenu(); // 앱 시작 시 메뉴 화면 표시
