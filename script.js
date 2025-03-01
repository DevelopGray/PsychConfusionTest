"use strict";
/************************************************************
 * FINAL FULL SCRIPT - ALIGNED WITH INTENDED ALGORITHM (CORRECTED VERSION)
 *
 * Changes & fixes applied:
 * 1) Replaced "Medium" => "Moderate" in categorizeScore() to match JSON.
 * 2) Removed second fetch of responsetext.json from displayResults(); uses global responseTexts.
 * 3) Correctly uses subcategory strings "Low Social Influence, High Autism Confusion" etc.
 * 4) Removed the 0.9 threshold confusion (only .3 & .6 are used, anything >=0.6 is High).
 * 5) Ensured final results are inserted into an existing DOM element .final-result (or user can adapt) instead of #final-response.
 ************************************************************/

// Global variables
let currentQuestionIndex = 0;
let responses = {};
let questions = [];
let totalQuestions = 0;

// Thresholds as specified in the algorithm
const thresholds = {
  low: 0.3,
  moderate: 0.6,
};

/**
 * Navigation Branching Rules (control test flow)
 */
const branchingRules = {
  // For question "1.4.5": "If I had the opportunity to permanently change how I present my gender, I would take it."
  "1.4.5": (responseIndex) => {
    if (responseIndex === 0) {
      return "1.5.1"; // Yes => proceed to first question of the medical transition block
    } else if (responseIndex === 1) {
      return "2.1.1"; // No => skip medical transition block, jump to social influence
    }
    return null;
  },
  // For question "2.1.1": "I started questioning my gender identity after talking with friends or engaging in online discussions."
  "2.1.1": (responseIndex) => {
    if (responseIndex === 0) {
      return null; // Yes => proceed normally
    } else if (responseIndex === 1) {
      return "3.1.1"; // No => skip social influence block, jump to autism confusion
    }
    return null;
  },
  // For question "3.1.1": "Certain parts of my body feel physically uncomfortable, even if I don’t think they are wrong for my gender."
  "3.1.1": (responseIndex) => {
    if (responseIndex === 0) {
      return "3.2.1"; // "Strongly Agree" => jump to the first question in the next block
    }
    return null;
  },
};

/**
 * Scoring Branching Rules (apply extra weight contributions)
 * These rules add additional weighted contributions from one question to a set of subsequent questions.
 */
const scoringBranchingRules = {
  // For dysphoria: if question "1.1.9" is answered,
  // add extra weight (0.6) to all questions in the medical transition block.
  "1.1.9": {
    subsequentQuestions: ["1.5.1", "1.5.2", "1.5.3", "1.5.4", "1.5.5"],
    weightAdjustment: 0.6,
  },
  // For social influence: if question "2.1.3" is answered,
  // add extra weight (0.1) to all questions in the "2.2.x" block.
  "2.1.3": {
    subsequentQuestions: ["2.2.1", "2.2.2", "2.2.3", "2.2.4", "2.2.5"],
    weightAdjustment: 0.1,
  },
};

// We'll store responsetext.json data here after initial load.
let responseTexts = {};

document.addEventListener("DOMContentLoaded", function () {
  loadQuestions();
});

/**
 * Fetch and flatten the questions from "questions.json".
 * Also load the responseTexts from "responsetext.json" once.
 */
async function loadQuestions() {
  try {
    const [questionsResponse, responseTextResponse] = await Promise.all([
      fetch("questions.json"),
      fetch("responsetext.json"),
    ]);

    if (!questionsResponse.ok || !responseTextResponse.ok) {
      throw new Error("Failed to load JSON files.");
    }

    const rawData = await questionsResponse.json();
    responseTexts = await responseTextResponse.json();

    // Flatten questions
    questions = rawData.flatMap((block) =>
      block.sections.flatMap((subsection) =>
        subsection.questions.map((q) => ({
          id: q.id,
          text: q.text,
          options: q.options,
          type: q.type,
          weight: q.weight,
          category: deriveCategoryFromQuestionId(q.id),
        }))
      )
    );

    totalQuestions = questions.length;
    initializeTest();
  } catch (error) {
    showError("Failed to load test data: " + error.message);
  }
}

/**
 * Derive category based on the question ID prefix.
 */
function deriveCategoryFromQuestionId(qid) {
  const firstDigit = qid.split(".")[0];
  if (firstDigit === "1") return "dysphoria";
  if (firstDigit === "2") return "socialInfluence";
  if (firstDigit === "3") return "autismConfusion";
  return "dysphoria"; // fallback
}

/**
 * Initialize the test UI and set up event listeners.
 */
function initializeTest() {
  document.querySelector(".start-btn").addEventListener("click", () => {
    document.querySelector(".landing").classList.remove("active");
    document.querySelector(".test-container").classList.add("active");
    showQuestion(currentQuestionIndex);
  });

  document.querySelector(".next-btn").addEventListener("click", nextQuestion);
  document
    .querySelector(".prev-btn")
    .addEventListener("click", previousQuestion);
  document.querySelector(".retake-btn").addEventListener("click", retakeTest);
}

/**
 * Display the question at the given index.
 */
function showQuestion(index) {
  if (index < 0 || index >= totalQuestions) {
    console.error("Invalid question index:", index);
    return;
  }

  const question = questions[index];
  if (!question || !question.options || question.options.length === 0) {
    console.error("Question or options are missing:", question);
    return;
  }

  const questionContainer = document.querySelector(".question-container");
  questionContainer.innerHTML = "";

  const questionTitle = document.createElement("h2");
  questionTitle.className = "question";
  questionTitle.textContent = question.text;
  questionContainer.appendChild(questionTitle);

  const optionsContainer = document.createElement("div");
  optionsContainer.className = "options";

  question.options.forEach((option, optionIndex) => {
    const optionButton = document.createElement("button");
    optionButton.className = "option-btn";
    optionButton.textContent = option;
    optionButton.addEventListener("click", () =>
      selectAnswer(optionIndex, question.id)
    );

    if (responses[question.id] === optionIndex) {
      optionButton.classList.add("selected");
    }
    optionsContainer.appendChild(optionButton);
  });

  questionContainer.appendChild(optionsContainer);

  document.querySelector(".prev-btn").disabled = index === 0;
  document.querySelector(".next-btn").disabled =
    responses[question.id] === undefined;
}

/**
 * Record the user's answer, update navigation flow if necessary, and enable navigation.
 */
function selectAnswer(optionIndex, questionId) {
  responses[questionId] = optionIndex;

  // Highlight the selected answer
  const allOptionButtons = document.querySelectorAll(".option-btn");
  allOptionButtons.forEach((btn, i) => {
    if (i === optionIndex) {
      btn.classList.add("selected");
    } else {
      btn.classList.remove("selected");
    }
  });

  // Enable Next
  document.querySelector(".next-btn").disabled = false;

  // If the answer was changed on an earlier question, re-evaluate the navigation flow.
  const changedIndex = questions.findIndex((q) => q.id === questionId);
  if (changedIndex < currentQuestionIndex) {
    recalcCurrentFlow();
  }
}

/**
 * Recalculate the current navigation flow based on all responses so far.
 * This function simulates the test flow from the beginning, applying navigation branching
 * rules as long as responses exist. It then updates currentQuestionIndex and displays the correct question.
 */
function recalcCurrentFlow() {
  let index = 0;
  while (index < totalQuestions) {
    const q = questions[index];
    if (responses[q.id] !== undefined && branchingRules[q.id]) {
      const jump = branchingRules[q.id](responses[q.id]);
      if (jump) {
        const jumpIndex = questions.findIndex((x) => x.id === jump);
        if (jumpIndex !== -1) {
          index = jumpIndex;
          continue;
        }
      }
    }
    // If a response exists for the current question and there is a next question, move forward.
    if (responses[q.id] !== undefined && index < totalQuestions - 1) {
      index++;
      // Stop if the next question has not yet been answered.
      if (responses[questions[index].id] === undefined) break;
      continue;
    }
    break;
  }
  currentQuestionIndex = index;
  showQuestion(currentQuestionIndex);
}

/**
 * Handle 'Next' button click and apply navigation branching.
 */
function nextQuestion() {
  const currentQ = questions[currentQuestionIndex];
  if (branchingRules[currentQ.id]) {
    const userAnswer = responses[currentQ.id];
    const jumpQuestionId = branchingRules[currentQ.id](userAnswer);
    if (jumpQuestionId) {
      const jumpIndex = questions.findIndex((q) => q.id === jumpQuestionId);
      if (jumpIndex !== -1) {
        currentQuestionIndex = jumpIndex;
        showQuestion(currentQuestionIndex);
        return;
      } else {
        console.warn(
          `Branching rule wanted to jump to ${jumpQuestionId}, but not found.`
        );
      }
    }
  }

  if (currentQuestionIndex < totalQuestions - 1) {
    currentQuestionIndex++;
    showQuestion(currentQuestionIndex);
  } else {
    calculateResults();
  }
}

/**
 * Handle 'Previous' button click.
 */
function previousQuestion() {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    showQuestion(currentQuestionIndex);
  }
}

/**
 * Main function to compute and display the final results.
 */
function calculateResults() {
  let categoryScores = {};
  let categoryWeights = {};

  // Sum up weighted numeric scores in each category
  questions.forEach((question) => {
    const chosenIndex = responses[question.id];
    if (chosenIndex !== undefined) {
      const numericValue = mapToNumeric(
        chosenIndex,
        question.options,
        question.type
      );
      if (!categoryScores[question.category]) {
        categoryScores[question.category] = 0;
        categoryWeights[question.category] = 0;
      }
      categoryScores[question.category] += question.weight * numericValue;
      categoryWeights[question.category] += question.weight;

      // Apply additional weighting rules if applicable
      if (scoringBranchingRules[question.id]) {
        const rule = scoringBranchingRules[question.id];
        rule.subsequentQuestions.forEach((subsequentQuestionId) => {
          const subsequentQuestion = questions.find(
            (q) => q.id === subsequentQuestionId
          );
          if (subsequentQuestion) {
            if (!categoryScores[subsequentQuestion.category]) {
              categoryScores[subsequentQuestion.category] = 0;
              categoryWeights[subsequentQuestion.category] = 0;
            }
            categoryScores[subsequentQuestion.category] +=
              rule.weightAdjustment * numericValue;
            categoryWeights[subsequentQuestion.category] +=
              rule.weightAdjustment;
          } else {
            console.warn(
              `Scoring rule references missing question: ${subsequentQuestionId}`
            );
          }
        });
      }
    }
  });

  // Derive final results (Low / Moderate / High) from average
  let finalScores = {};
  for (let category in categoryScores) {
    if (categoryWeights[category] === 0) {
      finalScores[category] = "Insufficient Data";
    } else {
      const averageScore = categoryScores[category] / categoryWeights[category];
      finalScores[category] = categorizeScore(averageScore);
    }
  }

  // Check for contradiction pairs
  const contradictions = detectContradictions(responses);

  // Make a copy of raw sums and apply control question adjustments
  let adjustedScores = { ...categoryScores };
  applyControlQuestionAdjustments(adjustedScores, responses);

  // Save JSON and show final results
  saveResults(finalScores, adjustedScores, contradictions);
  displayResults(finalScores);
}

/**
 * Maps the chosenIndex to a numeric 0..1 scale based on question type.
 */
function mapToNumeric(chosenIndex, allOptions, type) {
  if (
    typeof chosenIndex !== "number" ||
    chosenIndex === undefined ||
    !Array.isArray(allOptions) ||
    allOptions.length === 0
  ) {
    console.error(
      `Invalid input to mapToNumeric: chosenIndex=${chosenIndex}, allOptions=${JSON.stringify(
        allOptions
      )}, questionType=${type}`
    );
    return 0; // default fallback
  }

  if (type === "binary") {
    // index 0 => 1, index 1 => 0
    return chosenIndex === 0 ? 1 : 0;
  }

  if (type === "scale") {
    // map chosenIndex linearly to 0..1
    const maxIndex = allOptions.length - 1;
    if (maxIndex <= 0) {
      console.error(
        `Invalid scale question options detected: allOptions=${JSON.stringify(
          allOptions
        )}`
      );
      return 0;
    }
    if (
      !Number.isInteger(chosenIndex) ||
      chosenIndex < 0 ||
      chosenIndex > maxIndex
    ) {
      console.error(
        `Chosen index out of range: chosenIndex=${chosenIndex}, maxIndex=${maxIndex}`
      );
      return 0;
    }
    return chosenIndex / maxIndex;
  }

  console.error(`Unknown question type in mapToNumeric: ${type}`);
  return 0;
}

/**
 * Categorize a 0..1 average score as Low / Moderate / High.
 */
function categorizeScore(score) {
  if (
    typeof score !== "number" ||
    isNaN(score) ||
    score === null ||
    score === undefined
  ) {
    console.error(`Invalid score input: ${score}`);
    return "Invalid";
  }
  // clamp 0..1
  score = Math.max(0, Math.min(1, score));

  if (score < thresholds.low) {
    return "Low";
  } else if (score < thresholds.moderate) {
    return "Moderate";
  } else {
    return "High";
  }
}

/**
 * Some pairs of questions can contradict. If both are answered with a >2 index (i.e. strongly) we note a contradiction.
 */
function detectContradictions(responses) {
  let contradictions = [];

  const contradictionPairs = [
    {
      q1: "1.2.1",
      q2: "2.1.1",
      reason:
        "Claims long-term dysphoria but also says they're only questioning due to social influence.",
    },
    {
      q1: "1.1.9",
      q2: "3.1.8",
      reason:
        "Considers medical transition but claims it's sensory not dysphoria.",
    },
    {
      q1: "2.5.3",
      q2: "1.4.5",
      reason:
        "Claims stable identity but also influenced by social validation.",
    },
    {
      q1: "3.2.5",
      q2: "1.1.4",
      reason:
        "Feels identity shifts but also claims long-term detachment from assigned gender.",
    },
  ];

  contradictionPairs.forEach((pair) => {
    if (responses[pair.q1] !== undefined && responses[pair.q2] !== undefined) {
      if (responses[pair.q1] > 2 && responses[pair.q2] > 2) {
        contradictions.push({
          question1: pair.q1,
          question2: pair.q2,
          reason: pair.reason,
        });
      }
    }
  });

  return contradictions;
}

/**
 * Let the user re-check final category scores.
 * If social influence is particularly high, reduce dysphoria.
 * If sensory issues are high, raise autismConfusion.
 */
function applyControlQuestionAdjustments(categoryScores, responses) {
  const controlQuestionsDysphoria = ["2.1.1", "2.3.5", "2.5.3"];
  const controlQuestionsAutism = ["3.1.2", "3.1.3", "3.1.8"];

  let totalDysphoriaScore = 0;
  let countDysphoria = 0;
  controlQuestionsDysphoria.forEach((questionId) => {
    if (responses[questionId] !== undefined) {
      totalDysphoriaScore += responses[questionId];
      countDysphoria++;
    }
  });

  let totalAutismScore = 0;
  let countAutism = 0;
  controlQuestionsAutism.forEach((questionId) => {
    if (responses[questionId] !== undefined) {
      totalAutismScore += responses[questionId];
      countAutism++;
    }
  });

  const averageDysphoria =
    countDysphoria > 0 ? totalDysphoriaScore / countDysphoria : 0;
  const averageAutism = countAutism > 0 ? totalAutismScore / countAutism : 0;

  // If social-influence control questions are all high, reduce dysphoria.
  if (averageDysphoria > 0.5 && categoryScores.dysphoria !== undefined) {
    categoryScores.dysphoria *= 0.75;
  }

  // If autism control is high, we raise autism confusion.
  if (averageAutism > 0.5 && categoryScores.autismConfusion !== undefined) {
    categoryScores.autismConfusion *= 1.25;
  }
}

/**
 * Save the test data as a JSON file & show final results on screen.
 */
function saveResults(finalResults, adjustedScores, contradictions) {
  // Build top-level array name from Dysphoria level
  const responseCategoryKey = `${finalResults.dysphoria} Dysphoria Responses`;
  // Build subcategory from Social + Autism
  const subCategory = `${finalResults.socialInfluence} Social Influence, ${finalResults.autismConfusion} Autism Confusion`;

  let foundResponseText = "No matching response found.";
  if (responseTexts[responseCategoryKey]) {
    const found = responseTexts[responseCategoryKey].find(
      (entry) => entry.category === subCategory
    );
    if (found) {
      foundResponseText = found.response;
    }
  }

  const testData = {
    timestamp: new Date().toISOString(),
    originalResponses: responses,
    adjustedScores: adjustedScores,
    finalResults: finalResults,
    contradictions: contradictions.length > 0 ? contradictions : null,
    responseText: foundResponseText,
  };

  const jsonString = JSON.stringify(testData, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `test_results_${new Date()
    .toISOString()
    .replace(/:/g, "-")}.json`;
  a.rel = "noopener noreferrer";

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Actually display the final results on the screen.
 * We'll place them inside .results-summary and .final-result.
 */
function displayResults(finalScores) {
  const testContainer = document.querySelector(".test-container");
  const resultsSection = document.querySelector(".results");
  const resultsSummary = document.querySelector(".results-summary");
  const finalResultContainer = document.querySelector(".final-result");

  // Hide test container, show results.
  testContainer.classList.remove("active");
  resultsSection.classList.add("active");

  // Clear old content.
  if (resultsSummary) {
    resultsSummary.innerHTML = "";
  }
  if (finalResultContainer) {
    finalResultContainer.innerHTML = "";
  }

  // Build the subcategory key.
  const responseCategoryKey = `${finalScores.dysphoria} Dysphoria Responses`;
  const subCategory = `${finalScores.socialInfluence} Social Influence, ${finalScores.autismConfusion} Autism Confusion`;

  let matchedResponse = null;
  if (responseTexts[responseCategoryKey]) {
    matchedResponse = responseTexts[responseCategoryKey].find(
      (item) => item.category === subCategory
    );
  }

  // Create the results text without list formatting
  let overallHTML = "";
  for (const [cat, value] of Object.entries(finalScores)) {
    // Format the category name with spaces and proper capitalization
    const formattedCategory = cat
      .replace(/([a-z])([A-Z])/g, "$1 $2") // Add space before camel case
      .split(" ") // Split into words
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Capitalize first letter of each word
      .join(" "); // Join with spaces

    overallHTML += `<div><strong>${formattedCategory}</strong>: ${value}</div>`;
  }

  // Add a line break before the matched response
  overallHTML += `<br>`;

  if (matchedResponse) {
    overallHTML += `<div class='matched-response'><p>${matchedResponse.response}</p></div>`;
  } else {
    overallHTML += `<div class='matched-response error'><p>No matching response found in responsetext.json.</p></div>`;
  }

  if (resultsSummary) {
    resultsSummary.innerHTML = overallHTML;
  } else if (finalResultContainer) {
    finalResultContainer.innerHTML = overallHTML;
  } else {
    console.warn("No resultsSummary or finalResultContainer element found.");
  }
}

/**
 * Allow the user to retake the test.
 */
function retakeTest() {
  currentQuestionIndex = 0;
  responses = {};
  document.querySelector(".results").classList.remove("active");
  document.querySelector(".test-container").classList.add("active");
  showQuestion(currentQuestionIndex);
}

/**
 * Display a critical error message.
 */
function showError(msg) {
  alert(`ERROR: ${msg}`);
}
