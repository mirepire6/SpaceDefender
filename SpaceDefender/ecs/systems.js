import {
    Position,
    Velocity,
    Renderable,
    Player,
    Asteroid,
    Bullet,
    Collider,
    Controls
} from './components.js';

const PLAYER_ID = 'player';
const PLAYER_SPEED = 4;
const BULLET_SPEED = 7;
const ASTEROID_SPEED = 1.3;
const ASTEROID_SPAWN_INTERVAL = 48;
const SHOOT_COOLDOWN = 17;
const POINTS_PER_ASTEROID = 10;

const touching = (world, firstId, secondId) => {
    const positions = world.components.position;
    const colliders = world.components.collider;
    const dx = positions[firstId].x - positions[secondId].x;
    const dy = positions[firstId].y - positions[secondId].y;
    const radius = colliders[firstId].radius + colliders[secondId].radius;
    return dx * dx + dy * dy < radius * radius;
};

// INPUT
export const inputSystem = input => world => {
    const dx = (Number(input.right) - Number(input.left)) * PLAYER_SPEED;
    const dy = (Number(input.down) - Number(input.up)) * PLAYER_SPEED;

    return {
        ...world,
        components: {
            ...world.components,
            velocity: {
                ...world.components.velocity,
                [PLAYER_ID]: Velocity(dx, dy)
            },
            controls: {
                ...world.components.controls,
                [PLAYER_ID]: Controls(input.shooting)
            },
            player: {
                ...world.components.player,
                [PLAYER_ID]: Player(input.playerName)
            }
        }
    };
};

// SHOOTING
export const shootingSystem = world => {
    const cooldown = Math.max(0, world.shootTimer - 1);

    if (!world.components.controls[PLAYER_ID].shooting || cooldown > 0) {
        return {...world, shootTimer: cooldown};
    }

    const bulletId = `bullet${world.nextEntityId}`;
    const playerPosition = world.components.position[PLAYER_ID];

    return {
        ...world,
        entities: [...world.entities, bulletId],
        components: {
            ...world.components,
            position: {
                ...world.components.position,
                [bulletId]: Position(playerPosition.x, playerPosition.y - 20)
            },
            velocity: {
                ...world.components.velocity,
                [bulletId]: Velocity(0, -BULLET_SPEED)
            },
            renderable: {
                ...world.components.renderable,
                [bulletId]: Renderable('bullet', '#7ef9ff', 8)
            },
            bullet: {...world.components.bullet, [bulletId]: Bullet()},
            collider: {...world.components.collider, [bulletId]: Collider(4)}
        },
        shootTimer: SHOOT_COOLDOWN,
        nextEntityId: world.nextEntityId + 1
    };
};

// ASTEROID SPAWNING
export const asteroidSystem = world => {
    const spawnTimer = world.spawnTimer - 1;

    if (spawnTimer > 0) {
        return {...world, spawnTimer};
    }

    const asteroidId = `asteroid${world.nextEntityId}`;
    const radius = 20;
    const x = radius + Math.random() * (world.width - radius * 2);
    const speed = ASTEROID_SPEED + Math.random() * 1.2;

    return {
        ...world,
        entities: [...world.entities, asteroidId],
        components: {
            ...world.components,
            position: {
                ...world.components.position,
                [asteroidId]: Position(x, -radius)
            },
            velocity: {
                ...world.components.velocity,
                [asteroidId]: Velocity(0, speed)
            },
            renderable: {
                ...world.components.renderable,
                [asteroidId]: Renderable('asteroid', '#9b8878', radius)
            },
            asteroid: {...world.components.asteroid, [asteroidId]: Asteroid()},
            collider: {...world.components.collider, [asteroidId]: Collider(radius)}
        },
        spawnTimer: ASTEROID_SPAWN_INTERVAL,
        nextEntityId: world.nextEntityId + 1
    };
};

// MOVEMENT
export const movementSystem = world => {
    const movedPositions = Object.keys(world.components.velocity).map(id => {
        const position = world.components.position[id];
        const velocity = world.components.velocity[id];
        let x = position.x + velocity.dx;
        let y = position.y + velocity.dy;

        if (id === PLAYER_ID) {
            const size = world.components.renderable[id].size;
            x = Math.max(size, Math.min(world.width - size, x));
            y = Math.max(size, Math.min(world.height - size, y));
        }

        return [id, Position(x, y)];
    });

    return {
        ...world,
        components: {
            ...world.components,
            position: Object.fromEntries(movedPositions)
        }
    };
};

// COLLISION
export const collisionSystem = world => {
    const bulletIds = Object.keys(world.components.bullet);
    const asteroidIds = Object.keys(world.components.asteroid);
    const destroyedAsteroids = asteroidIds.filter(asteroidId =>
        bulletIds.some(bulletId => touching(world, bulletId, asteroidId))
    );
    const hitBullets = bulletIds.filter(bulletId =>
        destroyedAsteroids.some(asteroidId => touching(world, bulletId, asteroidId))
    );
    const playerHits = asteroidIds.filter(id =>
        !destroyedAsteroids.includes(id)
        && touching(world, PLAYER_ID, id)
    );

    const currentLives = world.components.lives[PLAYER_ID].value;
    const remainingLives = Math.max(0, currentLives - playerHits.length);

    return {
        ...world,
        components: {
            ...world.components,
            lives: {
                ...world.components.lives,
                [PLAYER_ID]: {value: remainingLives}
            }
        },
        pendingRemoval: [
            ...world.pendingRemoval,
            ...destroyedAsteroids,
            ...hitBullets,
            ...playerHits
        ],
        destroyedThisFrame: destroyedAsteroids.length,
        gameOver: remainingLives === 0
    };
};

// SCORE
export const scoreSystem = world => {
    if (world.destroyedThisFrame === 0) return world;

    const currentScore = world.components.score[PLAYER_ID].value;

    return {
        ...world,
        components: {
            ...world.components,
            score: {
                ...world.components.score,
                [PLAYER_ID]: {
                    value: currentScore + world.destroyedThisFrame * POINTS_PER_ASTEROID
                }
            }
        }
    };
};

// CLEANUP
export const cleanupSystem = world => {
    const offscreenIds = world.entities.filter(id => {
        const y = world.components.position[id].y;
        const size = world.components.renderable[id].size;
        return (world.components.bullet[id] && y + size < 0)
            || (world.components.asteroid[id] && y - size > world.height);
    });

    const idsToRemove = [...world.pendingRemoval, ...offscreenIds];
    const keptEntities = world.entities.filter(id => !idsToRemove.includes(id));

    const cleanedComponents = Object.keys(world.components).reduce(
        (components, componentName) => ({
            ...components,
            [componentName]: Object.fromEntries(
                Object.entries(world.components[componentName])
                    .filter(([id]) => !idsToRemove.includes(id))
            )
        }),
        {}
    );

    return {
        ...world,
        entities: keptEntities,
        components: cleanedComponents,
        pendingRemoval: [],
        destroyedThisFrame: 0
    };
};

const stars = Array.from({length: 70}).map((_, index) => ({
    x: (index * 83) % 800,
    y: (index * 47) % 500,
    size: index % 4 === 0 ? 2 : 1
}));

const drawPlayer = (ctx, position, renderable) => {
    ctx.fillStyle = renderable.color;
    ctx.beginPath();
    ctx.moveTo(position.x, position.y - renderable.size);
    ctx.lineTo(position.x - renderable.size, position.y + renderable.size);
    ctx.lineTo(position.x, position.y + renderable.size * 0.45);
    ctx.lineTo(position.x + renderable.size, position.y + renderable.size);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffb347';
    ctx.fillRect(position.x - 4, position.y + renderable.size - 2, 8, 8);
};

const drawAsteroid = (ctx, position, renderable) => {
    ctx.fillStyle = renderable.color;
    ctx.beginPath();
    ctx.arc(position.x, position.y, renderable.size, 0, Math.PI * 2);
    ctx.fill();
};

const drawBullet = (ctx, position, renderable) => {
    ctx.fillStyle = renderable.color;
    ctx.fillRect(position.x - 2, position.y - renderable.size, 4, renderable.size * 2);
};

// RENDER
export const renderSystem = ctx => world => {
    ctx.fillStyle = '#02050c';
    ctx.fillRect(0, 0, world.width, world.height);

    ctx.fillStyle = '#d9efff';
    stars.forEach(star => ctx.fillRect(star.x, star.y, star.size, star.size));

    world.entities.forEach(id => {
        const position = world.components.position[id];
        const renderable = world.components.renderable[id];
        if (!position || !renderable) return;

        if (renderable.shape === 'player') drawPlayer(ctx, position, renderable);
        if (renderable.shape === 'asteroid') drawAsteroid(ctx, position, renderable);
        if (renderable.shape === 'bullet') drawBullet(ctx, position, renderable);
    });

    const playerName = world.components.player[PLAYER_ID].name;
    const score = world.components.score[PLAYER_ID].value;
    const lives = world.components.lives[PLAYER_ID].value;

    ctx.fillStyle = '#eef7ff';
    ctx.font = '18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Player: ${playerName}`, 18, 28);
    ctx.fillText(`Score: ${score}`, 18, 52);
    ctx.textAlign = 'right';
    ctx.fillText(`Lives: ${lives}`, world.width - 18, 28);

    if (world.gameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
        ctx.fillRect(0, 0, world.width, world.height);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ff6666';
        ctx.font = 'bold 44px Arial';
        ctx.fillText('GAME OVER', world.width / 2, world.height / 2 - 35);
        ctx.fillStyle = '#ffffff';
        ctx.font = '22px Arial';
        ctx.fillText(`Player: ${playerName}`, world.width / 2, world.height / 2 + 8);
        ctx.fillText(`Final score: ${score}`, world.width / 2, world.height / 2 + 42);
    }

    return world;
};
