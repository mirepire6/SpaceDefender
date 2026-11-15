import {createEntity} from './ecs/entity.js';
import {createWorld} from './ecs/world.js';
import {
    Position,
    Velocity,
    Renderable,
    Player,
    Collider,
    Score,
    Lives,
    Controls
} from './ecs/components.js';
import {pipe} from './ecs/pipe.js';
import {
    inputSystem,
    shootingSystem,
    asteroidSystem,
    movementSystem,
    collisionSystem,
    scoreSystem,
    cleanupSystem,
    renderSystem
} from './ecs/systems.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('start-screen');
const gameScreen = document.getElementById('game-screen');
const nameInput = document.getElementById('player-name');
const startButton = document.getElementById('start-button');
const restartButton = document.getElementById('restart-button');

const emptyInput = playerName => ({
    left: false,
    right: false,
    up: false,
    down: false,
    shooting: false,
    playerName
});

let input = emptyInput('');
let world;
let running = false;

const createInitialWorld = playerName => {
    const player = createEntity('player');

    return createWorld(
        [player],
        {
            position: {[player]: Position(canvas.width / 2, canvas.height - 55)},
            velocity: {[player]: Velocity(0, 0)},
            renderable: {[player]: Renderable('player', '#76ddff', 16)},
            player: {[player]: Player(playerName)},
            asteroid: {},
            bullet: {},
            collider: {[player]: Collider(13)},
            score: {[player]: Score(0)},
            lives: {[player]: Lives(3)},
            controls: {[player]: Controls(false)}
        },
        {
            width: canvas.width,
            height: canvas.height,
            spawnTimer: 30,
            shootTimer: 0,
            nextEntityId: 1,
            pendingRemoval: [],
            destroyedThisFrame: 0
        }
    );
};

const gameLoop = () => {
    if (!running) return;

    world = pipe(
        inputSystem(input),
        shootingSystem,
        asteroidSystem,
        movementSystem,
        collisionSystem,
        scoreSystem,
        cleanupSystem,
        renderSystem(ctx)
    )(world);

    if (world.gameOver) {
        running = false;
        restartButton.hidden = false;
        return;
    }

    requestAnimationFrame(gameLoop);
};

const startGame = () => {
    const playerName = nameInput.value.trim();
    input = emptyInput(playerName);
    world = createInitialWorld(playerName);
    startScreen.hidden = true;
    gameScreen.hidden = false;
    restartButton.hidden = true;
    running = true;
    requestAnimationFrame(gameLoop);
};

const keyToInput = {
    ArrowLeft: 'left',
    KeyA: 'left',
    ArrowRight: 'right',
    KeyD: 'right',
    ArrowUp: 'up',
    KeyW: 'up',
    ArrowDown: 'down',
    KeyS: 'down',
    Space: 'shooting'
};

document.addEventListener('keydown', event => {
    const control = keyToInput[event.code];
    if (!control || !running) return;
    event.preventDefault();
    input = {...input, [control]: true};
});

document.addEventListener('keyup', event => {
    const control = keyToInput[event.code];
    if (!control || !running) return;
    event.preventDefault();
    input = {...input, [control]: false};
});

nameInput.addEventListener('input', () => {
    startButton.disabled = nameInput.value.trim().length === 0;
});

startButton.addEventListener('click', startGame);
restartButton.addEventListener('click', startGame);
