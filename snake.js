const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scale = 20;
let rows = canvas.height / scale;
let columns = canvas.width / scale;

let snake;
let food;
let specialFood;
let score = 0;
let speed = 150;
let gameLoop;
let boundaries = false;
let specialFoodActive = false;
let specialFoodTimer = 0;
let isPaused = false;
let newMode = false;
let mexicanWallMode = false;
let walls = [];
let timeSinceLastFood = 0;
let speedMultiplier = 1;
let hasReachedZero = false;
// Массив для отложенных установок стены – стена появится только когда змейка покинет соответствующую область
let pendingWallPlacements = [];

/* Функция проверки: занята ли клетка стеной (или ожидающей установкой) */
function isCellOccupied(x, y) {
  // Проверяем установленные стены
  for (let wall of walls) {
    if (wall.size === scale) { // обычная стена
      if (wall.x === x && wall.y === y) return true;
    } else if (wall.size === scale * 2) { // стена 2x2 – проверяем все 4 клетки
      if ((x === wall.x || x === wall.x + scale) && (y === wall.y || y === wall.y + scale))
        return true;
    }
  }
  // Проверяем отложенные установки
  for (let pending of pendingWallPlacements) {
    if (pending.size === scale) {
      if (pending.x === x && pending.y === y) return true;
    } else if (pending.size === scale * 2) {
      if ((x === pending.x || x === pending.x + scale) && (y === pending.y || y === pending.y + scale))
        return true;
    }
  }
  return false;
}

// Спрайты
const snakeHeadImg = new Image();
snakeHeadImg.src = "https://i.imgur.com/kcWZssI.png";
const redSnakeHeadImg = new Image();
redSnakeHeadImg.src = "https://i.imgur.com/G206j1Q.png";
const yellowSnakeHeadImg = new Image();
yellowSnakeHeadImg.src = "https://i.imgur.com/YdYoNM4.png";
const redFruitImg = new Image();
redFruitImg.src = "https://i.imgur.com/r5iFMkE.png";
const orangeFruitImg = new Image();
orangeFruitImg.src = "https://i.imgur.com/7Xxy9Xo.png";

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
if (isMobile) {
  canvas.width = 320;
  canvas.height = 320;
  rows = canvas.height / scale;
  columns = canvas.width / scale;
  document.getElementById("pauseButton").style.display = "block";
}

// Обработчики кнопок
document.getElementById("startButton").addEventListener("click", () => {
  startGame(false);
});
document.getElementById("newModeButton").addEventListener("click", () => {
  startGame("newMode");
});
document.getElementById("mexicanWallButton").addEventListener("click", () => {
  startGame("mexicanWall");
});
document.getElementById("restartButton").addEventListener("click", () => {
  startGame(newMode ? "newMode" : (mexicanWallMode ? "mexicanWall" : false));
});
document.getElementById("resumeButton").addEventListener("click", () => {
  document.getElementById("pauseScreen").style.display = "none";
  gameLoop = setInterval(updateGame, speed);
  if (isMobile) {
    document.getElementById("joystick").style.display = "block";
    document.getElementById("pauseButton").style.display = "block";
  }
  isPaused = false;
});
document.getElementById("replayButton").addEventListener("click", () => {
  resetGame();
  startGame(newMode ? "newMode" : (mexicanWallMode ? "mexicanWall" : false));
});
document.getElementById("pauseButton").addEventListener("click", () => {
  togglePause();
});

if (isMobile) {
  const joystick = document.getElementById("joystick");
  joystick.querySelector(".up").addEventListener("click", () => snake.changeDirection('up'));
  joystick.querySelector(".down").addEventListener("click", () => snake.changeDirection('down'));
  joystick.querySelector(".left").addEventListener("click", () => snake.changeDirection('left'));
  joystick.querySelector(".right").addEventListener("click", () => snake.changeDirection('right'));
}

function startGame(mode) {
  walls = [];
  pendingWallPlacements = [];
  speed = 350 - parseInt(document.getElementById("speedRange").value);
  // Границы карты устанавливаются по чекбоксу во всех режимах
  boundaries = document.getElementById("boundaryCheckbox").checked;
  newMode = (mode === "newMode");
  mexicanWallMode = (mode === "mexicanWall");

  // Подсвечиваем кнопку режима «Мексиканская стена», если выбран
  if (mexicanWallMode) {
    document.getElementById("mexicanWallButton").classList.add('active');
  } else {
    document.getElementById("mexicanWallButton").classList.remove('active');
  }

  document.getElementById("startScreen").style.display = "none";
  document.getElementById("endScreen").style.display = "none";
  canvas.style.display = "block";
  score = 0;
  timeSinceLastFood = 0;
  hasReachedZero = false;
  updateSpeedMultiplier();
  document.getElementById("scoreBoard").textContent = `Очки: ${score}`;
  document.getElementById("scoreBoard").style.display = "block";
  if (isMobile) {
    document.getElementById("joystick").style.display = "block";
  }
  setup();
}

function resetGame() {
  clearInterval(gameLoop);
  score = 0;
  timeSinceLastFood = 0;
  speedMultiplier = 1;
  isPaused = false;
  specialFoodActive = false;
  specialFoodTimer = 0;
  hasReachedZero = false;
  walls = [];
  pendingWallPlacements = [];
  document.getElementById("scoreBoard").textContent = `Очки: ${score}`;
  document.getElementById("scoreBoard").style.display = "block";
  document.getElementById("endScreen").style.display = "none";
  if (isMobile) {
    document.getElementById("joystick").style.display = "block";
    document.getElementById("pauseButton").style.display = "block";
  }
  canvas.style.display = "block";
}

function setup() {
  snake = new Snake();
  food = new Food();
  specialFood = new SpecialFood();
  food.pickLocation();
  specialFood.pickLocation();

  if (gameLoop) {
    clearInterval(gameLoop);
  }
  gameLoop = setInterval(updateGame, speed);
}

function updateGame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Рисуем установленные стены
  walls.forEach(wall => {
    ctx.fillStyle = "#DAA520";
    ctx.fillRect(wall.x, wall.y, wall.size, wall.size);
  });

  // Обрабатываем отложенные установки стен
  for (let i = pendingWallPlacements.length - 1; i >= 0; i--) {
    const pending = pendingWallPlacements[i];
    if (pending.type === "special") {
      // Проверяем, находится ли голова змейки внутри области 2x2
      if (snake.x < pending.x || snake.x >= pending.x + scale * 2 ||
          snake.y < pending.y || snake.y >= pending.y + scale * 2) {
        pending.stepsOut++;
      } else {
        pending.stepsOut = 0; // если змейка вернулась в область – сбрасываем счётчик
      }
      if (pending.stepsOut >= 2) {
        walls.push({ x: pending.x, y: pending.y, size: pending.size });
        pendingWallPlacements.splice(i, 1);
      }
    } else {
      // Для обычного фрукта (тип normal) ставим стену, как только голова покидает эту клетку
      if (!(snake.x === pending.x && snake.y === pending.y)) {
        walls.push({ x: pending.x, y: pending.y, size: pending.size });
        pendingWallPlacements.splice(i, 1);
      }
    }
  }

  // Рисуем фрукты
  food.draw();
  if (specialFoodActive) {
    specialFood.draw();
    specialFoodTimer++;
    if (specialFoodTimer > 45) {
      specialFoodActive = false;
      specialFoodTimer = 0;
    }
  } else if (Math.random() < 0.05) {
    specialFood.pickLocation();
    specialFoodActive = true;
  }

  snake.update();
  snake.draw();

  // Обработка поедания красного фрукта
  if (snake.eat(food)) {
    if (mexicanWallMode) {
      score += 1;
      // Отложенная установка для обычного фрукта (стена 1x1)
      pendingWallPlacements.push({ x: food.x, y: food.y, size: scale, type: "normal" });
    } else if (newMode) {
      score += Math.floor(1 * speedMultiplier);
    } else {
      score += 1;
    }
    document.getElementById("scoreBoard").textContent = `Очки: ${score}`;
    food.pickLocation();
    timeSinceLastFood = 0;
  } else if (newMode) {
    timeSinceLastFood++;
    if (score === 0) hasReachedZero = true;
    if (timeSinceLastFood > 20 && (hasReachedZero || score > 0)) {
      score--;
      document.getElementById("scoreBoard").textContent = `Очки: ${score}`;
      timeSinceLastFood = 0;
    }
    if (score < 0) {
      gameOver();
      return;
    }
  }

  // Обработка поедания специального (оранжевого) фрукта
  if (specialFoodActive && snake.eat(specialFood, true)) {
    if (mexicanWallMode) {
      score += 3;
      // Отложенная установка для специального фрукта (стена 2x2)
      pendingWallPlacements.push({ x: specialFood.x, y: specialFood.y, size: scale * 2, type: "special", stepsOut: 0 });
    } else if (newMode) {
      score += Math.floor(3 * speedMultiplier);
    } else {
      score += 3;
    }
    document.getElementById("scoreBoard").textContent = `Очки: ${score}`;
    specialFoodActive = false;
    specialFoodTimer = 0;
  }

  // Проверка столкновения с любыми стенами
  walls.forEach(wall => {
    if (snake.x < wall.x + wall.size &&
        snake.x + scale > wall.x &&
        snake.y < wall.y + wall.size &&
        snake.y + scale > wall.y) {
      gameOver();
    }
  });

  snake.checkCollision();
}

window.addEventListener("keydown", evt => {
  let direction = '';
  switch (evt.key.toLowerCase()) {
    case 'arrowup':
    case 'w':
    case 'ц':
      direction = 'up';
      break;
    case 'arrowdown':
    case 's':
    case 'ы':
      direction = 'down';
      break;
    case 'arrowleft':
    case 'a':
    case 'ф':
      direction = 'left';
      break;
    case 'arrowright':
    case 'd':
    case 'в':
      direction = 'right';
      break;
    case ' ':
      togglePause();
      break;
  }
  if (direction) snake.changeDirection(direction);
});

function togglePause() {
  if (isPaused) {
    document.getElementById("pauseScreen").style.display = "none";
    clearInterval(gameLoop);
    gameLoop = setInterval(updateGame, speed);
    if (isMobile) {
      document.getElementById("joystick").style.display = "block";
      document.getElementById("pauseButton").style.display = "block";
    }
  } else {
    document.getElementById("pauseScreen").style.display = "flex";
    clearInterval(gameLoop);
    if (isMobile) {
      document.getElementById("joystick").style.display = "none";
      document.getElementById("pauseButton").style.display = "none";
    }
  }
  isPaused = !isPaused;
}

function updateSpeedMultiplier() {
  if (newMode) {
    if (speed <= 100) {
      speedMultiplier = 3;
    } else if (speed <= 200) {
      speedMultiplier = 2;
    } else {
      speedMultiplier = 1;
    }
    document.getElementById("speedMultiplier").textContent = `Множитель скорости: x${speedMultiplier}`;
  } else {
    speedMultiplier = 1;
    document.getElementById("speedMultiplier").textContent = "";
  }
}

function Snake() {
  this.x = 0;
  this.y = 0;
  this.xSpeed = scale;
  this.ySpeed = 0;
  this.total = 0;
  this.tail = [];
  // Если режим «Мексиканская стена» – змейка жёлтая, если «Успокоить волю…» – красная, иначе зелёная
  this.isYellow = mexicanWallMode;
  this.isRed = (!mexicanWallMode && newMode);

  this.draw = function() {
    for (let i = 0; i < this.tail.length; i++) {
      if (this.isYellow) {
        ctx.fillStyle = (i % 2 === 0 ? "#FFD700" : "#DAA520");
      } else if (this.isRed) {
        ctx.fillStyle = (i % 2 === 0 ? "#FF4444" : "#CC0000");
      } else {
        ctx.fillStyle = (i % 2 === 0 ? "#7CFC00" : "#006400");
      }
      ctx.fillRect(this.tail[i].x, this.tail[i].y, scale, scale);
    }
    if (this.isYellow) {
      ctx.fillStyle = "#FFD700";
    } else if (this.isRed) {
      ctx.fillStyle = "#FF0000";
    } else {
      ctx.fillStyle = "#32CD32";
    }
    ctx.fillRect(this.x, this.y, scale, scale);
    this.drawHead();
  };

  this.drawHead = function() {
    ctx.save();
    ctx.translate(this.x + scale / 2, this.y + scale / 2);
    if (this.xSpeed > 0) {
      ctx.rotate(Math.PI / 2);
    } else if (this.xSpeed < 0) {
      ctx.rotate(-Math.PI / 2);
    } else if (this.ySpeed > 0) {
      ctx.rotate(Math.PI);
    }
    const headImg = this.isYellow ? yellowSnakeHeadImg : (this.isRed ? redSnakeHeadImg : snakeHeadImg);
    ctx.drawImage(headImg, -scale / 2, -scale / 2, scale, scale);
    ctx.restore();
  };

  this.update = function() {
    for (let i = 0; i < this.tail.length - 1; i++) {
      this.tail[i] = this.tail[i + 1];
    }
    if (this.total > 0) {
      // В режиме «Мексиканская стена» змейка не растёт – здесь просто обновляем последний сегмент хвоста
      this.tail[this.total - 1] = { x: this.x, y: this.y };
    }
    this.x += this.xSpeed;
    this.y += this.ySpeed;

    if (boundaries) {
      if (this.x >= canvas.width || this.y >= canvas.height || this.x < 0 || this.y < 0) {
        gameOver();
      }
    } else {
      this.x = (this.x + canvas.width) % canvas.width;
      this.y = (this.y + canvas.height) % canvas.height;
    }
  };

  this.changeDirection = function(direction) {
    switch (direction) {
      case 'up':
        if (this.ySpeed === 0) {
          this.xSpeed = 0;
          this.ySpeed = -scale;
        }
        break;
      case 'down':
        if (this.ySpeed === 0) {
          this.xSpeed = 0;
          this.ySpeed = scale;
        }
        break;
      case 'left':
        if (this.xSpeed === 0) {
          this.xSpeed = -scale;
          this.ySpeed = 0;
        }
        break;
      case 'right':
        if (this.xSpeed === 0) {
          this.xSpeed = scale;
          this.ySpeed = 0;
        }
        break;
    }
  };

  this.eat = function(food, isSpecial = false) {
    const foodSize = isSpecial ? scale * 2 : scale;
    if (
      this.x < food.x + foodSize &&
      this.x + scale > food.x &&
      this.y < food.y + foodSize &&
      this.y + scale > food.y
    ) {
      if (!mexicanWallMode) {
        // В остальных режимах змейка растёт
        this.total += isSpecial ? 3 : 1;
        for (let i = 0; i < (isSpecial ? 3 : 1); i++) {
          this.tail.push({});
        }
      }
      return true;
    }
    return false;
  };

  this.checkCollision = function() {
    for (let i = 0; i < this.tail.length; i++) {
      if (this.x === this.tail[i].x && this.y === this.tail[i].y) {
        gameOver();
      }
    }
  };
}

function Food() {
  this.x;
  this.y;
  this.pickLocation = function() {
    let valid = false;
    while (!valid) {
      let newX = Math.floor(Math.random() * columns) * scale;
      let newY = Math.floor(Math.random() * rows) * scale;
      // В режиме «Мексиканская стена» фрукт не может спавниться там, где уже стоит стена или ожидается её появление
      if (!mexicanWallMode || !isCellOccupied(newX, newY)) {
        this.x = newX;
        this.y = newY;
        valid = true;
      }
    }
  };
  this.draw = function() {
    const drawSize = scale * 1.5;
    const offset = (scale - drawSize) / 2;
    ctx.drawImage(redFruitImg, this.x + offset, this.y + offset, drawSize, drawSize);
  };
}

function SpecialFood() {
  this.x;
  this.y;
  this.pickLocation = function() {
    let valid = false;
    while (!valid) {
      let newX = Math.floor(Math.random() * (columns - 1)) * scale;
      let newY = Math.floor(Math.random() * (rows - 1)) * scale;
      if (!mexicanWallMode || !isCellOccupied(newX, newY)) {
        this.x = newX;
        this.y = newY;
        valid = true;
      }
    }
  };
  this.draw = function() {
    const drawSize = scale * 2;
    const offset = (scale - drawSize) / 2;
    ctx.drawImage(orangeFruitImg, this.x + offset, this.y + offset, drawSize, drawSize);
  };
}

function gameOver() {
  clearInterval(gameLoop);
  document.getElementById("pauseScreen").style.display = "none";
  document.getElementById("endScreen").style.display = "block";
  document.getElementById("scoreBoard").style.display = "none";
  document.getElementById("endScore").textContent = `Очки: ${score}`;
  canvas.style.display = "none";
  isPaused = false;
  if (isMobile) {
    document.getElementById("joystick").style.display = "none";
    document.getElementById("pauseButton").style.display = "none";
  }
}

document.getElementById("speedRangeEnd").addEventListener("input", () => {
  speed = 350 - parseInt(document.getElementById("speedRangeEnd").value);
  updateSpeedMultiplier();
});

document.getElementById("boundaryCheckboxEnd").addEventListener("change", () => {
  boundaries = document.getElementById("boundaryCheckboxEnd").checked;
});
