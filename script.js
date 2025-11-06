// DOM이 로드된 후 스크립트 실행
document.addEventListener('DOMContentLoaded', () => {

    // ========================================================================
    // (1) 로컬 스토리지 관리 함수 (진행 상황 저장 및 불러오기)
    // ========================================================================
    // 순차 풀이 진행 상황 저장 (카테고리 키: 인덱스)
    // **[복원 및 수정]** 세부 카테고리 키를 다시 사용합니다.
    let sequentialProgress = {
        'diesel_engine': 0,
        'diesel_electric_equipment': 0, // NEW: 전기장치
        'diesel_electric_circuit': 0,     // NEW: 전기회로
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
    
    // NEW: 풀이 모드 및 현재 풀이 카테고리 관리
    let practiceMode = 'random'; // random, sequential
    let currentPracticeCategories = []; // 현재 풀이 중인 카테고리 배열 (순차 풀이 시 사용)

    // 카테고리 이름 매핑 (NEW: 세부 카테고리 추가)
    // **[복원]** 세부 카테고리 이름을 다시 사용합니다.
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
    const electricSetupScreen = document.getElementById('electric-setup-screen'); // NEW
    const electricCategoryContainer = document.getElementById('electric-category-container'); // NEW
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
    
    // NEW: 디젤-전기 세부 설정 화면 표시 및 구성
    window.showElectricSetup = () => {
        currentMode = 'practice_setup';
        electricCategoryContainer.innerHTML = ''; // 기존 내용 비우기
        
        // 디젤-전기 세부 카테고리 정의 (HTML 체크박스에 있던 원래 키 사용)
        const electricCategories = [
            'diesel_electric_equipment',
            'diesel_electric_circuit'
        ];

        // 문제 수 계산 및 화면에 표시
        let totalCount = 0;
        let totalRemaining = 0;

        electricCategories.forEach(key => {
            const count = allQuestions[key] ? allQuestions[key].length : 0;
            const displayName = categoryNames[key];
            const currentProgress = sequentialProgress[key] || 0;
            const remainingCount = count - currentProgress;
            
            totalCount += count;
            totalRemaining += remainingCount;
            
            const div = document.createElement('div');
            div.className = 'flex items-center p-2 border rounded-lg bg-white shadow-sm hover:bg-gray-50';
            div.innerHTML = `
                <label class="flex items-center flex-1 cursor-pointer">
                    <input type="checkbox" class="electric-category-check h-5 w-5 text-blue-600" value="${key}">
                    <span class="ml-3 text-gray-700 font-medium">${displayName}</span>
                </label>
                <div class="text-right">
                    <span class="text-xs text-gray-400 block">${currentProgress} / ${count} 문제 풀이 완료</span>
                    <span class="text-base font-semibold text-gray-700">${remainingCount} 문제 남음</span>
                </div>
            `;
            electricCategoryContainer.appendChild(div);
        });
        
        // 총 문제 수 합산 표시
        const totalDiv = document.createElement('div');
        totalDiv.className = 'text-center p-3 bg-gray-100 rounded-lg font-bold text-gray-700';
        totalDiv.innerHTML = `총 문제 수: ${totalCount} 문제 (전체 ${totalRemaining} 문제 남음)`;
        electricCategoryContainer.appendChild(totalDiv);

        showScreen('electric-setup-screen');
    }
    
    // NEW: 디젤-전기 세부 연습 시작 함수
    window.startPracticeForElectric = (isAll, mode) => {
        practicePool = [];
        currentPracticeCategories = [];
        practiceMode = mode; // 모드 저장

        const selectedCategories = document.querySelectorAll('.electric-category-check:checked');
        if (selectedCategories.length === 0) {
            alert('하나 이상의 세부 과목을 선택하세요.');
            return;
        }

        selectedCategories.forEach(cb => {
            const key = cb.value; // 'diesel_electric_equipment' 또는 'diesel_electric_circuit'
            if (allQuestions[key]) {
                currentPracticeCategories.push(key); // 현재 풀이할 카테고리 저장
                
                if (mode === 'sequential') {
                    // 순차 풀이: 현재 진행 인덱스부터 끝까지 풀에 추가
                    const startIndex = sequentialProgress[key] || 0;
                    const questions = allQuestions[key].slice(startIndex);
                    practicePool = practicePool.concat(questions);
                } else {
                    // 랜덤 풀이: 전체 문제를 풀에 추가
                    practicePool = practicePool.concat(allQuestions[key]);
                }
            }
        });

        if (practicePool.length === 0) {
            alert(mode === 'sequential' ? '선택한 과목의 풀 문제가 없습니다. 문제를 모두 풀었거나 데이터가 없는지 확인하세요.' : '선택한 과목에 문제가 없습니다.');
            return;
        }

        currentMode = 'practice_run';
        if (mode === 'random') {
            shuffleArray(practicePool); // 랜덤 모드일 때만 섞기
        }
        currentQuestionIndex = 0; // 연습 풀이 시작은 항상 0번 인덱스
        setupQuizScreen('practice', mode); // 모드 정보 추가
        loadPracticeQuestion();
        showScreen('quiz-screen');
    }

    window.startPractice = (isAll) => {
        practicePool = [];
        currentPracticeCategories = [];
        practiceMode = 'random'; // 일반 연습 모드는 랜덤 고정

        let targetCategories = [];
        if (isAll) {
            // 전체 모드: 모든 카테고리 포함 
            targetCategories = Object.keys(allQuestions);
        } else {
            // 선택 모드: 체크된 카테고리의 문제만 추가
            const selectedChecks = document.querySelectorAll('.category-check:checked');
            if (selectedChecks.length === 0) {
                alert('하나 이상의 과목을 선택하세요.');
                return;
            }
            targetCategories = Array.from(selectedChecks).map(cb => cb.value);
        }

        targetCategories.forEach(key => {
            // **[수정]** allQuestions에 해당 키가 있는지 확인
            if (allQuestions.hasOwnProperty(key) && allQuestions[key]) {
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
        setupQuizScreen('practice');
        loadPracticeQuestion();
        showScreen('quiz-screen');
    }

    function loadPracticeQuestion() {
        // 피드백/해설 숨기기 및 버튼 활성화
        practiceFeedback.classList.add('hidden');
        explanationDiv.classList.add('hidden');
        nextPracticeBtn.classList.add('hidden');
        
        const q = practicePool[currentQuestionIndex];
        
        // NEW: 순차 풀이일 때 진행 상황 표시
        if (practiceMode === 'sequential') {
             // 순차 모드는 현재 풀의 문제 수가 전체 남은 문제 수임
             const totalRemaining = practicePool.length;
             quizTitle.innerText = `연속 풀이 모드 (${currentQuestionIndex + 1} / ${totalRemaining})`;
        }


        questionText.innerText = q.question;

        optionsContainer.innerHTML = ''; // 기존 옵션 삭제

        // NEW: 옵션에 인덱스 정보 추가 (순차 풀이 역추적용)
        q.options.forEach((option, index) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn border border-gray-300 p-4 rounded-lg text-left text-lg hover:bg-gray-100 transition-colors';
            btn.innerHTML = `<span class="font-medium mr-2">${index + 1}.</span> ${option}`;
            btn.onclick = () => checkPracticeAnswer(index, q.answer);
            optionsContainer.appendChild(btn);
        });
    }

    function checkPracticeAnswer(selectedIndex, correctIndex) {
        // 모든 버튼 비활성화
        const optionButtons = optionsContainer.querySelectorAll('.option-btn');
        optionButtons.forEach(btn => btn.disabled = true);

        if (selectedIndex === correctIndex) {
            feedbackMessage.innerText = '정답입니다!';
            feedbackMessage.className = 'text-2xl font-bold mb-4 text-green-600';
            optionButtons[selectedIndex].classList.add('correct');
        } else {
            feedbackMessage.innerText = '오답입니다.';
            feedbackMessage.className = 'text-2xl font-bold mb-4 text-red-600';
            optionButtons[selectedIndex].classList.add('incorrect');
            optionButtons[correctIndex].classList.add('correct'); // 정답 표시
        }
        
        // NEW: 순차 풀이일 경우에만 진행 상황 업데이트 (정답/오답과 무관하게)
        if (practiceMode === 'sequential') {
            const q = practicePool[currentQuestionIndex];
            
            // 현재 풀고 있는 문제가 allQuestions의 몇 번째 문제인지 확인 (질문 텍스트로 찾기)
            // **[수정]** 현재 풀이 중인 카테고리(currentPracticeCategories)만 검사합니다.
            for (const key of currentPracticeCategories) { 
                const categoryQuestions = allQuestions[key];
                
                // 해당 카테고리에 질문이 있는지 찾기
                if (categoryQuestions) {
                    const foundIndex = categoryQuestions.findIndex(item => item.question === q.question);
                    
                    if (foundIndex !== -1) {
                        // 현재 인덱스(foundIndex + 1)가 저장된 진행 인덱스보다 크면 업데이트
                        if (foundIndex + 1 > (sequentialProgress[key] || 0)) {
                             sequentialProgress[key] = foundIndex + 1; // 다음 문제의 인덱스 저장
                             saveProgress(); // 저장
                        }
                        break;
                    }
                }
            }
        }

        // 해설 표시
        explanationText.innerText = practicePool[currentQuestionIndex].explanation;
        explanationDiv.classList.remove('hidden');
        practiceFeedback.classList.remove('hidden');
        
        // 다음 문제 버튼 표시
        nextPracticeBtn.classList.remove('hidden');
    }

    window.nextPracticeQuestion = () => {
        currentQuestionIndex++;
        
        if (currentQuestionIndex >= practicePool.length) {
            // 순차 풀이 모드 종료
            if (practiceMode === 'sequential') {
                alert('선택한 과목의 문제를 모두 풀었습니다! 메뉴로 돌아갑니다.');
                goToMenu();
                return;
            }
            
            // 랜덤 풀이 모드
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
        // **[수정]** 디젤-전기 세부 카테고리를 다시 사용합니다.
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
            
            // 전체 문제 수가 부족할 경우를 대비
            if(testQuestions.length < requiredQuestions) {
                 console.warn(`전체 시험 문제 수 부족. (요청: 60, 가능: ${testQuestions.length})`);
                 requiredQuestions = testQuestions.length;
            }
            shuffleArray(testQuestions); // 두 시험 합쳐서 다시 섞기
        }

        if (testQuestions.length === 0) {
             alert('시험 문제를 생성할 수 없습니다. (데이터를 추가해주세요)');
             return;
        }
        
        if (testQuestions.length < requiredQuestions) {
            alert(`문제가 부족하여 ${testQuestions.length} 문제로 시험을 시작합니다. (요청: ${requiredQuestions} 문제)`);
        }

        currentMode = 'test_run';
        userAnswers = new Array(testQuestions.length).fill(-1); // -1은 미선택
        currentQuestionIndex = 0;
        score = 0;
        setupQuizScreen('test');
        loadTestQuestion();
        showScreen('quiz-screen');
    }
    
    function loadTestQuestion() {
        // 진행 상황 업데이트
        progressTracker.innerText = `${currentQuestionIndex + 1} / ${testQuestions.length}`;
        
        const q = testQuestions[currentQuestionIndex];
        questionText.innerText = q.question;

        optionsContainer.innerHTML = ''; // 기존 옵션 삭제
        
        const savedAnswer = userAnswers[currentQuestionIndex];

        q.options.forEach((option, index) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn border border-gray-300 p-4 rounded-lg text-left text-lg hover:bg-gray-100 transition-colors';
            btn.innerHTML = `<span class="font-medium mr-2">${index + 1}.</span> ${option}`;
            btn.onclick = () => selectTestAnswer(index);
            
            if(index === savedAnswer) {
                btn.classList.add('selected'); // 이전에 선택한 답안 표시
            }
            optionsContainer.appendChild(btn);
        });

        // 네비게이션 버튼 상태 업데이트
        prevBtn.disabled = (currentQuestionIndex === 0);
        nextBtn.classList.toggle('hidden', currentQuestionIndex === testQuestions.length - 1);
        submitBtn.classList.toggle('hidden', currentQuestionIndex !== testQuestions.length - 1);
    }

    window.selectTestAnswer = (selectedIndex) => {
        userAnswers[currentQuestionIndex] = selectedIndex;
        // 시각적 피드백
        const optionButtons = optionsContainer.querySelectorAll('.option-btn');
        optionButtons.forEach((btn, index) => {
            btn.classList.toggle('selected', index === selectedIndex);
        });
    }

    window.navigateTest = (direction) => {
        currentQuestionIndex += direction;
        // 인덱스 범위 체크 (필요시)
        if (currentQuestionIndex < 0) currentQuestionIndex = 0;
        if (currentQuestionIndex >= testQuestions.length) currentQuestionIndex = testQuestions.length - 1;
        
        loadTestQuestion();
    }

    window.submitTest = () => {
        // 모든 문제를 풀었는지 확인
        const unanwsered = userAnswers.indexOf(-1);
        if (unanwsered !== -1) {
            if (!confirm(`아직 풀지 않은 문제(${unanwsered + 1}번)가 있습니다. 그대로 제출하시겠습니까?`)) {
                currentQuestionIndex = unanwsered;
                loadTestQuestion();
                return;
            }
        }
        
        // 채점
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
        
        // 결과 리뷰 컨테이너 비우기
        resultsDisplayContainer.innerHTML = '';
        showScreen('results-screen');
    }

    // ========================================================================
    // (6) 핵심 로직: 결과 보기
    // ========================================================================
    window.showResults = (filter) => {
        resultsDisplayContainer.innerHTML = ''; // 비우기

        testQuestions.forEach((q, index) => {
            const userAnswer = userAnswers[index];
            const isCorrect = (userAnswer === q.answer);

            if (filter === 'incorrect' && isCorrect) {
                return; // 틀린 문제 보기 모드인데 정답이면 건너뜀
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
    
    /** 퀴즈 화면 UI를 모드에 맞게 설정 */
    function setupQuizScreen(mode, practiceMode = 'random') {
        if (mode === 'practice') {
            // NEW: practiceMode에 따라 제목 변경
            if (practiceMode === 'sequential') {
                quizTitle.innerText = '연속 풀이 모드 (순서대로)';
            } else {
                quizTitle.innerText = '연습 모드 (랜덤)';
            }
            
            progressTracker.classList.add('hidden');
            practiceFeedback.classList.add('hidden'); // 시작 시 숨김
            nextPracticeBtn.classList.add('hidden'); // 시작 시 숨김
            prevBtn.classList.add('hidden');
            nextBtn.classList.add('hidden');
            submitBtn.classList.add('hidden');
            quitBtn.innerText = '연습 종료';
        } else { // test
            quizTitle.innerText = '시험 모드';
            progressTracker.classList.remove('hidden');
            practiceFeedback.classList.add('hidden'); // 시험 중엔 항상 숨김
            nextPracticeBtn.classList.add('hidden'); // 시험 중엔 항상 숨김
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
        
        // 문제가 부족할 경우, 있는 만큼만 반환
        if (pool.length < count) {
            console.warn(`요청된 문제 수(${count})보다 풀의 문제 수(${pool.length})가 적습니다.`);
        }
        return pool.slice(0, count);
    }

    // ========================================================================
    // (8) 초기 실행
    // ========================================================================
    goToMenu(); // 앱 시작 시 메뉴 화면 표시

});
