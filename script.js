// --- 전역 변수 ---
let allQuiz = []; // quiz-data.js 에서 불러온 모든 퀴즈
let currentQuizSet = []; // 현재 풀고 있는 퀴즈 세트
let currentQuestionIndex = 0;
let score = 0;
let currentCategory = ""; // 현재 선택한 메인 카테고리

// --- DOM 요소 ---
const screens = document.querySelectorAll('.screen');
const mainMenuScreen = document.getElementById('main-menu-screen');
const subMenuScreen = document.getElementById('sub-menu-screen');
const quizScreen = document.getElementById('quiz-screen');
const resultScreen = document.getElementById('result-screen');

const mainMenuContainer = document.getElementById('main-menu-container');
const subMenuContainer = document.getElementById('sub-menu-container');
const subMenuTitle = document.getElementById('sub-menu-title');

const quizCounter = document.getElementById('quiz-counter');
const quizScore = document.getElementById('quiz-score');
const questionText = document.getElementById('question-text');
const questionImage = document.getElementById('question-image');
const optionsContainer = document.getElementById('options-container');
const explanationText = document.getElementById('explanation-text');
const nextBtn = document.getElementById('btn-next');
const resultText = document.getElementById('result-text');

// --- 초기화 ---
document.addEventListener('DOMContentLoaded', () => {
    allQuiz = quizData; // quiz-data.js의 변수
    setupMainMenu();
    setupEventListeners();
});

// --- 1. 메뉴 설정 ---

function setupMainMenu() {
    // 1. quizData에서 메인 카테고리 목록 추출
    const categories = {
        "디젤": ["기관", "제동", "전기"],
        "철도시스템": ["선로", "신호", "전차선", "차량", "통신"]
    };

    mainMenuContainer.innerHTML = ''; // 초기화

    // 2. 메인 카테고리 버튼 생성
    Object.keys(categories).forEach(category => {
        const count = allQuiz.filter(q => q.category === category).length;
        const button = createMenuButton(category, count);
        button.addEventListener('click', () => {
            currentCategory = category;
            setupSubMenu(category, categories[category]);
            showScreen(subMenuScreen);
        });
        mainMenuContainer.appendChild(button);
    });
}

function setupSubMenu(category, subCategories) {
    subMenuTitle.textContent = category; // 서브메뉴 타이틀 설정
    subMenuContainer.innerHTML = ''; // 초기화

    // 1. "전체" 버튼 추가
    const allCount = allQuiz.filter(q => q.category === category).length;
    const allButton = createMenuButton(`${category} 전체`, allCount);
    allButton.addEventListener('click', () => {
        startQuiz(category, "all");
    });
    subMenuContainer.appendChild(allButton);

    // 2. 각 서브 카테고리 버튼 생성
    subCategories.forEach(sub => {
        const count = allQuiz.filter(q => q.category === category && q.subCategory === sub).length;
        const button = createMenuButton(sub, count);
        button.addEventListener('click', () => {
            startQuiz(category, sub);
        });
        subMenuContainer.appendChild(button);
    });
}

// 메뉴 버튼 생성 헬퍼
function createMenuButton(text, count) {
    const button = document.createElement('button');
    button.className = 'btn-menu';
    button.innerHTML = `${text} <span>(${count}개)</span>`;
    return button;
}

// --- 2. 퀴즈 진행 ---

function startQuiz(category, subCategory) {
    // 1. 문제 필터링
    if (subCategory === "all") {
        currentQuizSet = allQuiz.filter(q => q.category === category);
    } else {
        currentQuizSet = allQuiz.filter(q => q.category === category && q.subCategory === subCategory);
    }

    if (currentQuizSet.length === 0) {
        alert("선택한 카테고리에 문제가 없습니다.");
        return;
    }

    // 2. 퀴즈 섞기 및 초기화
    shuffleArray(currentQuizSet);
    currentQuestionIndex = 0;
    score = 0;

    // 3. 퀴즈 화면 표시
    showQuestion();
    showScreen(quizScreen);
}

function showQuestion() {
    // 1. 리셋
    optionsContainer.innerHTML = '';
    explanationText.style.display = 'none';
    explanationText.textContent = '';
    nextBtn.classList.add('hidden');

    // 2. 현재 문제 데이터 가져오기
    const q = currentQuizSet[currentQuestionIndex];

    // 3. 문제 및 점수 표시
    questionText.textContent = q.question;
    quizCounter.textContent = `${currentQuestionIndex + 1} / ${currentQuizSet.length}`;
    quizScore.textContent = `점수: ${score}`;

    // 4. 이미지 표시 (있을 경우)
    if (q.image) {
        questionImage.src = q.image;
        questionImage.style.display = 'block';
    } else {
        questionImage.style.display = 'none';
    }

    // 5. 보기 버튼 생성
    q.options.forEach((option, index) => {
        const button = document.createElement('button');
        button.className = 'btn-option';
        button.textContent = option;
        button.dataset.index = index; // 정답 비교를 위해 인덱스 저장
        button.addEventListener('click', selectAnswer);
        optionsContainer.appendChild(button);
    });
}

function selectAnswer(e) {
    const selectedButton = e.target;
    const selectedIndex = parseInt(selectedButton.dataset.index);
    const correctIndex = currentQuizSet[currentQuestionIndex].answer;

    // 1. 모든 버튼 비활성화
    document.querySelectorAll('.btn-option').forEach(btn => {
        btn.disabled = true;
    });

    // 2. 정답/오답 확인 및 표시
    if (selectedIndex === correctIndex) {
        selectedButton.classList.add('correct');
        score++;
        quizScore.textContent = `점수: ${score}`;
    } else {
        selectedButton.classList.add('incorrect');
        // 정답 버튼도 표시
        document.querySelector(`.btn-option[data-index="${correctIndex}"]`).classList.add('correct');
    }
    
    // 3. 해설 표시 (있을 경우)
    const explanation = currentQuizSet[currentQuestionIndex].explanation;
    if (explanation) {
        explanationText.textContent = `해설: ${explanation}`;
        explanationText.style.display = 'block';
    }

    // 4. 다음 버튼 표시
    nextBtn.classList.remove('hidden');
}

function showNextQuestion() {
    currentQuestionIndex++;
    if (currentQuestionIndex < currentQuizSet.length) {
        showQuestion();
    } else {
        showResult();
    }
}

function showResult() {
    resultText.textContent = `${currentQuizSet.length} 문제 중 ${score}개를 맞혔습니다!`;
    showScreen(resultScreen);
}

// --- 3. 이벤트 리스너 및 헬퍼 ---

function setupEventListeners() {
    // 뒤로가기 버튼들
    document.getElementById('btn-back-main').addEventListener('click', () => showScreen(mainMenuScreen));
    document.getElementById('btn-back-to-menu-quiz').addEventListener('click', () => showScreen(mainMenuScreen));
    document.getElementById('btn-back-to-menu-result').addEventListener('click', () => showScreen(mainMenuScreen));

    // 다음 문제 버튼
    nextBtn.addEventListener('click', showNextQuestion);
    
    // 다시 풀기 버튼
    document.getElementById('btn-retry').addEventListener('click', () => {
        // 현재 카테고리/서브카테고리 정보가 없으므로 메인으로 보냄
        // (더 복잡하게 만들려면 마지막 퀴즈 설정을 저장해야 함)
        // 여기서는 간단하게 마지막 풀었던 퀴즈를 다시 푼다.
        startQuiz(currentQuizSet[0].category, "all"); // 임시로 'all'로 설정
        // 이 부분은 사용자가 "다시 풀기"의 정의를 내려주면 수정 가능
    });
}

// 화면 전환
function showScreen(screenToShow) {
    screens.forEach(screen => screen.classList.remove('active'));
    screenToShow.classList.add('active');
}

// 배열 섞기
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}