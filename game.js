const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const livesEl = document.getElementById("lives");
const levelEl = document.getElementById("level");
const overlayEl = document.getElementById("overlay");
const startButton = document.getElementById("startButton");
const touchControls = Array.from(document.querySelectorAll(".touch-control"));
const LEVEL_SEQUENCE = [1, 6, 7, 8, 9, 10];
const MAX_LEVEL = LEVEL_SEQUENCE[LEVEL_SEQUENCE.length - 1];

const game = {
  width: canvas.width,
  height: canvas.height,
  state: "ready",
  level: 1,
  lives: 3,
  lastTime: 0,
  homePulse: 0,
};

const caughtEffect = {
  active: false,
  elapsed: 0,
  duration: 1.35,
  x: 0,
  y: 0,
  particles: [],
};

const spawnFlash = {
  active: false,
  elapsed: 0,
  duration: 1,
};

const goal = {
  x: 0,
  y: 48,
  width: 180,
  height: 78,
  minX: 0,
  maxX: 0,
  speed: 0,
  direction: 1,
};

const player = {
  width: 54,
  height: 54,
  speed: 260,
  baseSpeed: 260,
  x: 0,
  y: 0,
  direction: "up",
};

const lanes = [
  { y: 150, height: 86 },
  { y: 250, height: 86 },
  { y: 350, height: 86 },
  { y: 450, height: 86 },
];

const keys = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
};

const NET_BLUEPRINTS = [
  { lane: 0, x: 0, width: 130, offsetY: 12, direction: 1, speedBonus: 30 },
  { lane: 0, x: 300, width: 92, offsetY: 18, direction: 1, speedBonus: 55 },
  { lane: 1, x: 760, width: 120, offsetY: 10, direction: -1, speedBonus: 25 },
  { lane: 1, x: 420, width: 96, offsetY: 20, direction: -1, speedBonus: 65 },
  { lane: 2, x: 80, width: 110, offsetY: 12, direction: 1, speedBonus: 70 },
  { lane: 2, x: 600, width: 150, offsetY: 18, direction: 1, speedBonus: 35 },
  { lane: 3, x: 840, width: 88, offsetY: 20, direction: -1, speedBonus: 85 },
  { lane: 3, x: 360, width: 128, offsetY: 14, direction: -1, speedBonus: 45 },
  { lane: 0, x: 560, width: 84, offsetY: 22, direction: 1, speedBonus: 95 },
  { lane: 1, x: 140, width: 130, offsetY: 14, direction: -1, speedBonus: 75 },
  { lane: 2, x: 860, width: 88, offsetY: 24, direction: 1, speedBonus: 100 },
  { lane: 3, x: 120, width: 108, offsetY: 16, direction: -1, speedBonus: 90 },
];

const LEVELS = [
  { netCount: 4, speedMultiplier: 0.8, widthScale: 1.08, goalWidth: 200, goalSpeed: 0, playerSpeed: 270, message: "Training tide. Learn the lanes." },
  { netCount: 5, speedMultiplier: 0.9, widthScale: 1.03, goalWidth: 188, goalSpeed: 0, playerSpeed: 265, message: "More nets. Pick smarter angles." },
  { netCount: 6, speedMultiplier: 1.0, widthScale: 1.0, goalWidth: 180, goalSpeed: 0, playerSpeed: 260, message: "Timing matters now." },
  { netCount: 7, speedMultiplier: 1.07, widthScale: 0.98, goalWidth: 172, goalSpeed: 0, playerSpeed: 258, message: "Full traffic. Keep calm." },
  { netCount: 8, speedMultiplier: 1.14, widthScale: 0.95, goalWidth: 164, goalSpeed: 90, playerSpeed: 255, message: "Sweet Home now drifts inside the tide lane." },
  { netCount: 9, speedMultiplier: 1.22, widthScale: 0.93, goalWidth: 156, goalSpeed: 110, playerSpeed: 252, message: "Small openings. Commit late." },
  { netCount: 10, speedMultiplier: 1.3, widthScale: 0.9, goalWidth: 148, goalSpeed: 125, playerSpeed: 248, message: "Fast nets, moving home lane." },
  { netCount: 11, speedMultiplier: 1.38, widthScale: 0.88, goalWidth: 140, goalSpeed: 145, playerSpeed: 245, message: "Precision crossing only." },
  { netCount: 12, speedMultiplier: 1.46, widthScale: 0.86, goalWidth: 132, goalSpeed: 165, playerSpeed: 242, message: "Almost home. No panic moves." },
  { netCount: 12, speedMultiplier: 1.58, widthScale: 0.82, goalWidth: 124, goalSpeed: 190, playerSpeed: 238, message: "Final gauntlet. Crabbie needs mastery." },
];

let nets = [];
const crabbieSprite = new Image();
let crabbieSpriteReady = false;

crabbieSprite.addEventListener("load", () => {
  crabbieSpriteReady = true;
});
crabbieSprite.src = "assets/crabbie-spritesheet.png";

function getLevelConfig() {
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, game.level - 1))];
}

function getNextLevel() {
  const currentIndex = LEVEL_SEQUENCE.indexOf(game.level);
  return LEVEL_SEQUENCE[currentIndex + 1] ?? null;
}

function createNets() {
  const config = getLevelConfig();
  const baseSpeed = 108 + game.level * 18;

  nets = NET_BLUEPRINTS.slice(0, config.netCount).map((blueprint) =>
    createNet({
      x: blueprint.x,
      width: Math.round(blueprint.width * config.widthScale),
      y: lanes[blueprint.lane].y + blueprint.offsetY,
      direction: blueprint.direction,
      speed: (baseSpeed + blueprint.speedBonus) * config.speedMultiplier,
    })
  );
}

function createNet({ x, width, y, direction, speed }) {
  return {
    x,
    y,
    width,
    height: 52,
    direction,
    speed,
  };
}

function configureLevel() {
  const config = getLevelConfig();
  player.speed = config.playerSpeed;
  goal.width = config.goalWidth;
  goal.height = 78;
  goal.y = lanes[0].y + 4;
  goal.minX = 40;
  goal.maxX = game.width - goal.width - 40;
  goal.x = game.width / 2 - goal.width / 2;
  goal.speed = config.goalSpeed;
  goal.direction = game.level % 2 === 0 ? 1 : -1;
  createNets();
}

function resetPlayer() {
  player.x = game.width / 2 - player.width / 2;
  player.y = game.height - player.height - 24;
  startSpawnFlash();
}

function startSpawnFlash() {
  spawnFlash.active = true;
  spawnFlash.elapsed = 0;
}

function clearMovement() {
  Object.keys(keys).forEach((key) => {
    keys[key] = false;
  });
  touchControls.forEach((control) => {
    control.classList.remove("pressed");
  });
}

function resetGame() {
  game.level = LEVEL_SEQUENCE[0];
  game.lives = 3;
  game.state = "ready";
  game.homePulse = 0;
  caughtEffect.active = false;
  caughtEffect.particles = [];
  configureLevel();
  resetPlayer();
  updateHud(getLevelConfig().message);
  showOverlay("Reach Sweet Home", "");
}

function startGame() {
  if (game.state === "playing" || game.state === "caught") {
    return;
  }

  if (game.state === "lost" || game.state === "finished") {
    game.level = LEVEL_SEQUENCE[0];
    game.lives = 3;
    configureLevel();
    resetPlayer();
  }

  game.state = "playing";
  startSpawnFlash();
  hideOverlay();
  updateHud(getLevelConfig().message);
}

function loseLife() {
  if (game.lives <= 0) {
    game.lives = 0;
    game.state = "lost";
    updateHud("Caught in the nets");
    showOverlay(
      "Game Over",
      "The trap nets caught Crabbie before he reached home. Press R to try again."
    );
    return;
  }

  resetPlayer();
  game.state = "playing";
  updateHud("Careful. Reset and read the lane.");
}

function createCaughtParticle(angle, speed, index) {
  const waterColors = ["#e9fbff", "#aeeaf5", "#61c3d7", "#fff4d2"];
  return {
    x: caughtEffect.x,
    y: caughtEffect.y + 6,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - 120 - Math.random() * 80,
    radius: 4 + Math.random() * 8,
    life: 0,
    maxLife: 0.78 + Math.random() * 0.46,
    color: waterColors[index % waterColors.length],
    sandY: Math.min(game.height - 30, caughtEffect.y + 86 + Math.random() * 18),
    landed: false,
  };
}

function startCaughtEffect() {
  if (caughtEffect.active || game.state !== "playing") {
    return;
  }

  game.lives = Math.max(0, game.lives - 1);
  game.state = "caught";
  clearMovement();
  updateHud("Caught in the nets");

  caughtEffect.active = true;
  caughtEffect.elapsed = 0;
  caughtEffect.x = player.x + player.width / 2;
  caughtEffect.y = player.y + player.height / 2;
  caughtEffect.particles = [];

  for (let i = 0; i < 34; i += 1) {
    const angle = -Math.PI + (Math.PI * i) / 33;
    const speed = 70 + Math.random() * 170;
    caughtEffect.particles.push(createCaughtParticle(angle, speed, i));
  }
}

function finishCaughtEffect() {
  caughtEffect.active = false;
  caughtEffect.particles = [];
  loseLife();
}

function winRound() {
  const nextLevel = getNextLevel();

  if (nextLevel === null) {
    game.state = "finished";
    updateHud("Crabbie is finally home");
    showOverlay(
      "Crabbie Made It Home",
      "You cleared every active level. Press Space or Enter to play again, or R to reset anytime."
    );
    return;
  }

  game.level = nextLevel;
  game.state = "won";
  configureLevel();
  resetPlayer();
  updateHud(`Level ${game.level} unlocked`);
  showOverlay(
    `Level ${game.level} Ready`,
    ""
  );
}

function updateHud() {
  livesEl.textContent = String(game.lives);
  levelEl.textContent = `${game.level}/${MAX_LEVEL}`;
}

function showOverlay(title, message) {
  overlayEl.classList.remove("hidden");
  overlayEl.querySelector("h2").textContent = title;
  const messageEl = overlayEl.querySelector(".overlay-panel p:nth-of-type(2)");
  messageEl.textContent = message;
  messageEl.hidden = message.trim().length === 0;
}

function hideOverlay() {
  overlayEl.classList.add("hidden");
}

function setMovementKey(key, isPressed) {
  if (key in keys) {
    keys[key] = isPressed;
  }
}

function releaseTouchControl(control) {
  const key = control.dataset.key;
  setMovementKey(key, false);
  control.classList.remove("pressed");
}

function clampPlayer() {
  player.x = Math.max(16, Math.min(game.width - player.width - 16, player.x));
  player.y = Math.max(16, Math.min(game.height - player.height - 16, player.y));
}

function updatePlayer(dt) {
  let moveX = 0;
  let moveY = 0;

  if (keys.ArrowLeft) moveX -= 1;
  if (keys.ArrowRight) moveX += 1;
  if (keys.ArrowUp) moveY -= 1;
  if (keys.ArrowDown) moveY += 1;

  if (moveX !== 0 && moveY !== 0) {
    const diagonalScale = Math.SQRT1_2;
    moveX *= diagonalScale;
    moveY *= diagonalScale;
  }

  if (moveY < 0) {
    player.direction = "up";
  } else if (moveY > 0) {
    player.direction = "down";
  } else if (moveX > 0) {
    player.direction = "right";
  } else if (moveX < 0) {
    player.direction = "left";
  }

  player.x += moveX * player.speed * dt;
  player.y += moveY * player.speed * dt;
  clampPlayer();
}

function updateNets(dt) {
  nets.forEach((net) => {
    net.x += net.speed * net.direction * dt;

    if (net.direction === 1 && net.x > game.width + 40) {
      net.x = -net.width - 40;
    }

    if (net.direction === -1 && net.x + net.width < -40) {
      net.x = game.width + 40;
    }
  });
}

function updateCaughtEffect(dt) {
  if (!caughtEffect.active) {
    return;
  }

  const slowDt = dt * 0.62;
  caughtEffect.elapsed += slowDt;

  caughtEffect.particles.forEach((particle) => {
    particle.life += slowDt;

    if (!particle.landed) {
      particle.vy += 420 * slowDt;
      particle.x += particle.vx * slowDt;
      particle.y += particle.vy * slowDt;

      if (particle.y >= particle.sandY) {
        particle.y = particle.sandY;
        particle.vx *= 0.32;
        particle.vy *= -0.18;
        particle.radius *= 0.68;
        particle.landed = true;
      }
    } else {
      particle.x += particle.vx * slowDt;
      particle.radius *= 0.972;
    }
  });

  if (caughtEffect.elapsed >= caughtEffect.duration) {
    finishCaughtEffect();
  }
}

function updateSpawnFlash(dt) {
  if (!spawnFlash.active) {
    return;
  }

  spawnFlash.elapsed += dt;

  if (spawnFlash.elapsed >= spawnFlash.duration) {
    spawnFlash.active = false;
  }
}

function updateGoal(dt) {
  if (goal.speed <= 0) {
    return;
  }

  goal.x += goal.speed * goal.direction * dt;

  if (goal.x <= goal.minX) {
    goal.x = goal.minX;
    goal.direction = 1;
  }

  if (goal.x >= goal.maxX) {
    goal.x = goal.maxX;
    goal.direction = -1;
  }
}

function hitTest(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function checkCollisions() {
  for (const net of nets) {
    if (hitTest(player, net)) {
      startCaughtEffect();
      return;
    }
  }

  if (hitTest(player, goal)) {
    winRound();
  }
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, game.height);
  sky.addColorStop(0, "#b7ebf5");
  sky.addColorStop(0.38, "#90d7e7");
  sky.addColorStop(0.38, "#f3deb2");
  sky.addColorStop(1, "#ddb16c");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, game.width, game.height);

  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.beginPath();
  ctx.arc(120, 100, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(182, 82, 28, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f6e5bd";
  ctx.fillRect(0, 120, game.width, game.height - 120);

  lanes.forEach((lane, index) => {
    const wave = ctx.createLinearGradient(0, lane.y, game.width, lane.y);
    wave.addColorStop(0, index % 2 === 0 ? "#8bcfe0" : "#63bbd1");
    wave.addColorStop(1, index % 2 === 0 ? "#63bbd1" : "#8bcfe0");
    ctx.fillStyle = wave;
    roundRect(ctx, 24, lane.y, game.width - 48, lane.height, 18);
    ctx.fill();
  });

  for (let i = 0; i < 28; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? "#e2b772" : "#d8a761";
    ctx.beginPath();
    ctx.arc(20 + i * 36, 590 + (i % 3) * 8, 6 + (i % 4), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGoalBack() {
  game.homePulse += 0.04;
  const houseWidth = goal.width;
  const houseHeight = goal.height + 18;
  const roofHeight = 44;

  ctx.save();
  ctx.translate(goal.x + goal.width / 2, goal.y + goal.height / 2 + 4);

  ctx.fillStyle = "rgba(33, 61, 42, 0.18)";
  ctx.beginPath();
  ctx.ellipse(0, houseHeight / 2 + 10, houseWidth * 0.44, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#72472f";
  ctx.beginPath();
  ctx.moveTo(0, -houseHeight / 2 - roofHeight + 8);
  ctx.lineTo(houseWidth / 2 + 28, -houseHeight / 2 + 4);
  ctx.lineTo(houseWidth / 2 + 10, -houseHeight / 2 + 24);
  ctx.lineTo(0, -houseHeight / 2 - roofHeight + 30);
  ctx.lineTo(-houseWidth / 2 - 10, -houseHeight / 2 + 24);
  ctx.lineTo(-houseWidth / 2 - 28, -houseHeight / 2 + 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawGoalFront() {
  const pulse = Math.sin(game.homePulse) * 4;
  const houseWidth = goal.width;
  const houseHeight = goal.height + 18;
  const roofHeight = 44;
  const caveWidth = Math.max(34, houseWidth * 0.28);
  const caveTop = 18;

  ctx.save();
  ctx.translate(goal.x + goal.width / 2, goal.y + goal.height / 2 + 4);

  ctx.fillStyle = "#8a5839";
  ctx.beginPath();
  ctx.moveTo(0, -houseHeight / 2 - roofHeight + 22);
  ctx.lineTo(houseWidth / 2 + 6, -houseHeight / 2 + 22);
  ctx.lineTo(houseWidth / 2 - 10, -houseHeight / 2 + 38);
  ctx.lineTo(0, -houseHeight / 2 - roofHeight + 40);
  ctx.lineTo(-houseWidth / 2 + 10, -houseHeight / 2 + 38);
  ctx.lineTo(-houseWidth / 2 - 6, -houseHeight / 2 + 22);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#9fc16d";
  roundRect(ctx, -houseWidth / 2, -houseHeight / 2, houseWidth, houseHeight, 18);
  ctx.fill();

  ctx.fillStyle = "#b8d685";
  ctx.fillRect(-houseWidth * 0.24, -houseHeight / 2 + 18, houseWidth * 0.1, houseHeight * 0.16);
  ctx.fillRect(houseWidth * 0.14, -houseHeight / 2 + 18, houseWidth * 0.1, houseHeight * 0.16);

  ctx.fillStyle = "#27412d";
  ctx.beginPath();
  ctx.moveTo(-caveWidth / 2, houseHeight / 2);
  ctx.lineTo(-caveWidth / 2, caveTop + 8);
  ctx.quadraticCurveTo(0, caveTop - 14, caveWidth / 2, caveTop + 8);
  ctx.lineTo(caveWidth / 2, houseHeight / 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(135, 177, 98, 0.65)";
  ctx.beginPath();
  ctx.moveTo(-caveWidth / 2 + 10, houseHeight / 2);
  ctx.lineTo(-caveWidth / 2 + 10, caveTop + 18);
  ctx.quadraticCurveTo(0, caveTop + pulse * 0.3, caveWidth / 2 - 10, caveTop + 18);
  ctx.lineTo(caveWidth / 2 - 10, houseHeight / 2);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(72, 107, 52, 0.95)";
  ctx.lineWidth = 3;
  roundRect(ctx, -houseWidth / 2, -houseHeight / 2, houseWidth, houseHeight, 18);
  ctx.stroke();
  ctx.restore();
}

function drawNet(net) {
  ctx.save();
  ctx.translate(net.x, net.y);

  if (net.direction > 0) {
    ctx.translate(net.width, 0);
    ctx.scale(-1, 1);
  }

  ctx.translate(net.width / 2, net.height / 2);
  ctx.rotate(-Math.PI / 6);
  ctx.translate(-net.width / 2, -net.height / 2);

  const basketWidth = net.width * 0.68;
  const basketX = 4;
  const basketTop = 13;
  const basketBottom = net.height - 7;
  const basketCenterX = basketX + basketWidth * 0.48;
  const basketCenterY = basketTop + 13;
  const rimHeight = 22;
  const handleStartX = basketX + basketWidth * 0.74;
  const handleStartY = basketTop + 7;
  const handleEndX = net.width - 6;
  const handleEndY = 7;
  const woodDark = "#7b4b25";
  const woodMid = "#ad7440";
  const woodLight = "#d6a06b";

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.fillStyle = "rgba(83, 48, 24, 0.16)";
  ctx.beginPath();
  ctx.ellipse(basketCenterX + 1, basketBottom - 1, basketWidth * 0.45, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = woodDark;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(handleStartX, handleStartY);
  ctx.quadraticCurveTo(net.width * 0.78, handleStartY - 7, handleEndX, handleEndY);
  ctx.stroke();

  ctx.strokeStyle = woodMid;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(handleStartX, handleStartY);
  ctx.quadraticCurveTo(net.width * 0.78, handleStartY - 7, handleEndX, handleEndY);
  ctx.stroke();

  ctx.strokeStyle = woodLight;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(handleStartX + 5, handleStartY - 2);
  ctx.quadraticCurveTo(net.width * 0.82, handleStartY - 8, handleEndX - 6, handleEndY - 1);
  ctx.stroke();

  ctx.strokeStyle = woodDark;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(handleStartX - 4, handleStartY + 2);
  ctx.lineTo(handleStartX + 10, handleStartY - 4);
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 248, 232, 0.34)";
  ctx.beginPath();
  ctx.moveTo(basketX + 6, basketTop + 10);
  ctx.quadraticCurveTo(basketCenterX, basketTop - 6, basketX + basketWidth - 2, basketTop + 9);
  ctx.quadraticCurveTo(basketX + basketWidth - 7, basketBottom + 9, basketCenterX - 4, basketBottom + 4);
  ctx.quadraticCurveTo(basketX + 4, basketBottom + 3, basketX + 6, basketTop + 10);
  ctx.fill();

  ctx.strokeStyle = "rgba(123, 75, 37, 0.8)";
  ctx.lineWidth = 2;
  for (let i = 1; i <= 4; i += 1) {
    const ratio = i / 5;
    const topX = basketX + 8 + basketWidth * ratio;
    const bottomX = basketCenterX + (ratio - 0.5) * basketWidth * 0.5;
    ctx.beginPath();
    ctx.moveTo(topX, basketTop + 6);
    ctx.quadraticCurveTo(topX - basketWidth * 0.08, basketCenterY + 10, bottomX, basketBottom + 2);
    ctx.stroke();
  }

  for (let i = 0; i < 3; i += 1) {
    const y = basketTop + 14 + i * 9;
    const inset = 8 + i * 5;
    ctx.beginPath();
    ctx.moveTo(basketX + inset, y);
    ctx.quadraticCurveTo(basketCenterX, y + 8 + i * 2, basketX + basketWidth - inset * 0.55, y + 1);
    ctx.stroke();
  }

  ctx.strokeStyle = woodDark;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(basketCenterX, basketCenterY, basketWidth * 0.5, rimHeight * 0.52, -0.08, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = woodMid;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(basketCenterX, basketCenterY - 1, basketWidth * 0.48, rimHeight * 0.45, -0.08, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(123, 75, 37, 0.92)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(basketX + 8, basketTop + 18);
  ctx.quadraticCurveTo(basketX + 10, basketBottom + 2, basketCenterX - 3, basketBottom + 6);
  ctx.quadraticCurveTo(basketX + basketWidth - 9, basketBottom + 3, basketX + basketWidth - 6, basketTop + 17);
  ctx.stroke();

  ctx.restore();
}

function drawCrabbie() {
  if (!spawnFlash.active) {
    drawCrabbieAt(player.x, player.y, player.width, player.height, player.direction, 1);
    return;
  }

  const progress = Math.min(1, spawnFlash.elapsed / spawnFlash.duration);
  const pulse = Math.sin(progress * Math.PI * 10) * 0.5 + 0.5;
  const opacity = 0.28 + pulse * 0.72;
  const centerX = player.x + player.width / 2;
  const centerY = player.y + player.height / 2;

  ctx.save();
  ctx.globalAlpha = (1 - progress) * (0.42 + pulse * 0.22);
  ctx.fillStyle = "#f4fbff";
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, player.width * (0.62 + pulse * 0.22), player.height * (0.58 + pulse * 0.18), 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#aeeaf5";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, player.width * (0.82 + progress * 0.36), player.height * (0.74 + progress * 0.28), 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  drawCrabbieAt(player.x, player.y, player.width, player.height, player.direction, opacity);
}

function drawCrabbieAt(x, y, width, height, direction, opacity = 1) {
  ctx.save();
  ctx.globalAlpha *= opacity;

  if (crabbieSpriteReady) {
    const frameSize = crabbieSprite.width / 4;
    const directionMap = {
      up: 0,
      right: 1,
      down: 2,
      left: 3,
    };
    const frameIndex = directionMap[direction] ?? 0;
    const spriteScale = width / player.width;
    const spritePaddingX = 20 * spriteScale;
    const spritePaddingY = 18 * spriteScale;
    ctx.drawImage(
      crabbieSprite,
      frameIndex * frameSize,
      0,
      frameSize,
      crabbieSprite.height,
      x - spritePaddingX,
      y - spritePaddingY,
      width + spritePaddingX * 2,
      height + spritePaddingY * 2
    );
    ctx.restore();
    return;
  }

  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const bob = Math.sin(performance.now() / 120) * 1.5;

  ctx.translate(centerX, centerY + bob);

  ctx.strokeStyle = "#44261f";
  ctx.lineWidth = 4;

  for (let side = -1; side <= 1; side += 2) {
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.moveTo(side * 16, i * 8);
      ctx.quadraticCurveTo(side * 28, i * 10, side * 34, i * 18);
      ctx.stroke();
    }
  }

  ctx.fillStyle = "#5d3a2e";
  ctx.beginPath();
  ctx.ellipse(0, 4, 24, 20, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#6f4a3a";
  ctx.beginPath();
  ctx.ellipse(0, -2, 20, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#44261f";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-8, -10);
  ctx.lineTo(-14, -22);
  ctx.moveTo(8, -10);
  ctx.lineTo(14, -22);
  ctx.stroke();

  ctx.fillStyle = "#fffdf7";
  ctx.beginPath();
  ctx.arc(-12, -20, 6, 0, Math.PI * 2);
  ctx.arc(12, -20, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1b2a2f";
  ctx.beginPath();
  ctx.arc(-11, -20, 2.4, 0, Math.PI * 2);
  ctx.arc(11, -20, 2.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ff8f57";
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawCaughtEffect() {
  if (!caughtEffect.active) {
    return;
  }

  const progress = Math.min(1, caughtEffect.elapsed / caughtEffect.duration);
  const wobble = Math.sin(progress * Math.PI * 8) * (1 - progress) * 9;
  const shrink = Math.max(0.08, 1 - progress * 0.88);
  const crabbieSize = player.width * shrink;
  const crabbieX = caughtEffect.x - crabbieSize / 2 + wobble;
  const crabbieY = caughtEffect.y - crabbieSize / 2 + progress * 18;

  drawCrabbieAt(crabbieX, crabbieY, crabbieSize, crabbieSize, player.direction, 1 - progress);

  ctx.save();
  caughtEffect.particles.forEach((particle) => {
    const fade = Math.max(0, 1 - particle.life / particle.maxLife);
    if (fade <= 0 || particle.radius <= 0.3) {
      return;
    }

    ctx.globalAlpha = fade * 0.9;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.ellipse(
      particle.x,
      particle.y,
      particle.radius * (particle.landed ? 1.8 : 0.8),
      particle.radius * (particle.landed ? 0.34 : 1.18),
      particle.landed ? 0 : particle.vx * 0.006,
      0,
      Math.PI * 2
    );
    ctx.fill();
  });

  const ringAlpha = Math.max(0, 0.52 - progress * 0.46);
  ctx.globalAlpha = ringAlpha;
  ctx.strokeStyle = "#d6a95d";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(caughtEffect.x, caughtEffect.y + 88, 34 + progress * 54, 7 + progress * 8, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawHudHints() {
  ctx.fillStyle = "rgba(27, 42, 47, 0.7)";
  ctx.font = '600 18px "Fredoka"';
  ctx.textAlign = "left";
  ctx.fillText("Avoid the trap nets", 28, 36);
  ctx.textAlign = "right";
  ctx.fillText("R to restart", game.width - 28, 36);
}

function draw() {
  ctx.clearRect(0, 0, game.width, game.height);
  drawBackground();
  drawGoalBack();
  nets.forEach(drawNet);
  drawGoalFront();
  if (game.state === "caught") {
    drawCaughtEffect();
  } else {
    drawCrabbie();
  }
  drawHudHints();
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function tick(timestamp) {
  const dt = Math.min((timestamp - game.lastTime) / 1000 || 0, 0.0167 * 2);
  game.lastTime = timestamp;

  if (game.state === "playing") {
    updateSpawnFlash(dt);
    updatePlayer(dt);
    updateNets(dt);
    updateGoal(dt);
    checkCollisions();
  } else if (game.state === "caught") {
    updateNets(dt * 0.22);
    updateCaughtEffect(dt);
  } else {
    updateSpawnFlash(dt);
  }

  draw();
  requestAnimationFrame(tick);
}

window.addEventListener("keydown", (event) => {
  if (event.key in keys) {
    keys[event.key] = true;
    event.preventDefault();
  }

  if (event.key === " " || event.code === "Space" || event.key === "Enter") {
    startGame();
    event.preventDefault();
  }

  if (event.key.toLowerCase() === "r") {
    resetGame();
  }
});

window.addEventListener("keyup", (event) => {
  if (event.key in keys) {
    keys[event.key] = false;
    event.preventDefault();
  }
});

touchControls.forEach((control) => {
  control.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    control.setPointerCapture(event.pointerId);
    setMovementKey(control.dataset.key, true);
    control.classList.add("pressed");

    if (game.state !== "playing") {
      startGame();
    }
  });

  control.addEventListener("pointerup", (event) => {
    event.preventDefault();
    releaseTouchControl(control);
  });

  control.addEventListener("pointercancel", () => {
    releaseTouchControl(control);
  });

  control.addEventListener("lostpointercapture", () => {
    releaseTouchControl(control);
  });
});

window.addEventListener("blur", () => {
  Object.keys(keys).forEach((key) => {
    keys[key] = false;
  });
  touchControls.forEach((control) => {
    control.classList.remove("pressed");
  });
});

startButton.addEventListener("click", startGame);

configureLevel();
resetPlayer();
updateHud(getLevelConfig().message);
requestAnimationFrame(tick);
