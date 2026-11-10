const field = document.querySelector("#game-window");
const player = document.querySelector("#player");
const robots = [...document.querySelectorAll(".robo > div")];
const scoreElement = document.querySelector("#score");
const collisionModal = document.querySelector("#collision-modal");
const playAgainButton = document.querySelector("#play-again");
const nameDialogBackdrop = document.querySelector("#name-dialog-backdrop");
const nameDialog = document.querySelector("#name-dialog");
const playerNameInput = document.querySelector("#player-name");
const finalScoreElement = document.querySelector("#final-score");
const scoreSaveStatus = document.querySelector("#score-save-status");
const sanskritNumerals = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];
const configuredObstaclesPerPoint = Number(window.SPACE_SHIP_SCORE_CONFIG?.obstaclesPerPoint);
const obstaclesPerPoint = Number.isFinite(configuredObstaclesPerPoint) && configuredObstaclesPerPoint >= 1
  ? Math.floor(configuredObstaclesPerPoint)
  : 5;

let playerX = (100 - (matchMedia("(max-width: 600px)").matches ? 8 : 5)) / 2;
let playerY = 80;
let score = 0;
let obstaclesPassed = 0;
let gameOver = false;
let gameStarted = false;
let runStartedAt = null;
let robotY = robots.map(() => 3);
let robotSpeed = robots.map(() => 0.8 + Math.random() * 1.5);

const playerSize = () => (matchMedia("(max-width: 600px)").matches ? 8 : 5);
const formatScore = (value) => {
  const devanagari = String(value)
    .split("")
    .map((digit) => sanskritNumerals[Number(digit)])
    .join("");
  return `${value} (${devanagari})`;
};

robots.forEach((robot, index) => {
  robot.style.left = `${(index * (100 - playerSize())) / (robots.length - 1)}%`;
  robot.style.top = `${robotY[index]}%`;
});

const renderPlayer = () => {
  player.style.left = `${playerX}%`;
  player.style.top = `${playerY}%`;
};

const resetGame = () => {
  gameOver = false;
  collisionModal.hidden = true;
  playerX = (100 - playerSize()) / 2;
  playerY = 80;
  score = 0;
  obstaclesPassed = 0;
  scoreElement.textContent = formatScore(score);
  scoreSaveStatus.hidden = true;
  scoreSaveStatus.textContent = "";
  robotY = robots.map(() => 3);
  robotSpeed = robots.map(() => 0.8 + Math.random() * 1.5);
  robots.forEach((robot, index) => {
    robot.style.top = `${robotY[index]}%`;
  });
  renderPlayer();
  if (window.zatamScore?.reset) window.zatamScore.reset();
  runStartedAt = Date.now();
  field.focus();
};

const submitLeaderboardScore = async () => {
  scoreSaveStatus.hidden = false;
  scoreSaveStatus.className = "zatam-game-status zatam-game-status-info";
  scoreSaveStatus.textContent = "Saving your score...";

  if (!window.zatamScore || typeof window.zatamScore.submit !== "function") {
    scoreSaveStatus.className = "zatam-game-status zatam-game-status-error";
    scoreSaveStatus.textContent = "The leaderboard is not available right now.";
    return;
  }

  try {
    const leaderboardScore = window.zatamScore.clampScore
      ? window.zatamScore.clampScore(score)
      : Math.max(0, Math.min(100, Math.round(score)));
    const submission = await window.zatamScore.submit(leaderboardScore, {
      result: "completed",
      metrics: {
        rawScore: score,
        obstaclesPassed,
        endReason: "collision",
        elapsedSeconds: Math.max(0, Math.floor((Date.now() - runStartedAt) / 1000)),
      },
    });

    if (submission?.ok) {
      scoreSaveStatus.className = "zatam-game-status zatam-game-status-success";
      scoreSaveStatus.textContent = "Score saved to the leaderboard ✓";
    } else if (submission?.reason === "not-signed-in") {
      scoreSaveStatus.className = "zatam-game-status zatam-game-status-info";
      scoreSaveStatus.textContent = "Sign in to save your score to the leaderboard.";
    } else if (submission?.reason === "already-submitted") {
      scoreSaveStatus.className = "zatam-game-status zatam-game-status-success";
      scoreSaveStatus.textContent = "Score already saved ✓";
    } else {
      scoreSaveStatus.className = "zatam-game-status zatam-game-status-error";
      scoreSaveStatus.textContent = "Your score could not be saved.";
    }
  } catch (error) {
    console.error("[046-ds] Score submission failed:", error);
    scoreSaveStatus.className = "zatam-game-status zatam-game-status-error";
    scoreSaveStatus.textContent = "The leaderboard score could not be saved.";
  }
};

const updateRobots = () => {
  robots.forEach((robot, index) => {
    robotY[index] += robotSpeed[index];
    if (robotY[index] > 94) {
      robotY[index] = 3;
      robotSpeed[index] = 0.8 + Math.random() * 1.5;
      obstaclesPassed += 1;
      if (obstaclesPassed % obstaclesPerPoint === 0) {
        score += 1;
        scoreElement.textContent = formatScore(score);
      }
    }
    robot.style.top = `${robotY[index]}%`;
  });
};

const hasCollision = () => {
  const ship = player.getBoundingClientRect();
  return robots.some((robot) => {
    const obstacle = robot.getBoundingClientRect();
    return ship.left < obstacle.right && ship.right > obstacle.left &&
      ship.top < obstacle.bottom && ship.bottom > obstacle.top;
  });
};

const movePlayer = (key) => {
  if (!gameStarted || gameOver) return;
  const step = 3;
  if (key === "w") playerY = Math.max(0, playerY - step);
  if (key === "s") {
    const playerHeight = (player.getBoundingClientRect().height / field.clientHeight) * 100;
    playerY = Math.min(100 - playerHeight, playerY + step);
  }
  if (key === "a") playerX = Math.max(0, playerX - step);
  if (key === "d") playerX = Math.min(100 - playerSize(), playerX + step);

  updateRobots();
  renderPlayer();
  if (hasCollision()) {
    gameOver = true;
    finalScoreElement.textContent = formatScore(score);
    collisionModal.hidden = false;
    playAgainButton.focus();
    submitLeaderboardScore();
  }
};

playAgainButton.addEventListener("click", resetGame);

nameDialog.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = playerNameInput.value.trim();
  if (!name) {
    playerNameInput.setCustomValidity("Please enter your name.");
    playerNameInput.reportValidity();
    return;
  }

  playerNameInput.setCustomValidity("");
  document.querySelector("#name").textContent = name;
  gameStarted = true;
  runStartedAt = Date.now();
  nameDialogBackdrop.hidden = true;
  field.focus();
});

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (!["w", "a", "s", "d"].includes(key)) return;
  if (!gameStarted || gameOver) return;
  if (event.target instanceof HTMLElement && event.target.isContentEditable) return;
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
  event.preventDefault();
  movePlayer(key);
});

document.querySelectorAll("[data-move]").forEach((button) => {
  button.addEventListener("click", () => movePlayer(button.dataset.move));
});

window.addEventListener("resize", () => {
  const size = playerSize();
  robots.forEach((robot, index) => {
    robot.style.left = `${(index * (100 - size)) / (robots.length - 1)}%`;
  });
  playerX = Math.min(playerX, 100 - playerSize());
  renderPlayer();
});
renderPlayer();
window.addEventListener("load", () => {
  window.requestAnimationFrame(() => {
    nameDialogBackdrop.hidden = false;
    playerNameInput.focus();
  });
}, { once: true });
