const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    const container = document.getElementById('gameContainer');
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
}
resizeCanvas();
window.addEventListener('resize', () => {
    resizeCanvas();
    if (gameRunning) {
        groundY = canvas.height - 80;
        // Don't lock player position on resize, just ground
    }
});

let gameRunning = false;
let score = 0;
let coinsCollected = 0;
let kills = 0;
let lives = 3;
let gameTime = 0;
let batMode = false;
let warningShown = false;
let difficultyLevel = 1;

let baseSpeed = 3;
let gameSpeed = baseSpeed;

const player = {
    x: 100,
    y: 300,
    width: 36,
    height: 56,
    velocityY: 0,
    velocityX: 0,
    jumping: false,
    doubleJump: false,
    grounded: false,
    sliding: false,
    slideTimer: 0,
    attacking: false,
    attackTimer: 0,
    attackCooldown: 0,
    invincible: false,
    invincibleTimer: 0,
    runFrame: 0,
    runTimer: 0,
    capeWave: 0,
    facingRight: true
};

const gravity = 0.55;
const jumpPower = -9;
const moveSpeed = 5;
let groundY = 300;

let platforms = [];
let flyingRoots = [];
let coins = [];
let enemies = [];
let spikes = [];
let particles = [];
let projectiles = [];
let bgStars = [];
let bgClouds = [];

const keys = {};
let lastTapTime = 0;
let touchStartX = 0;
let touchStartY = 0;
let isTouching = false;

// Get screen type for root positioning
function getScreenType() {
    return canvas.height > canvas.width ? 'portrait' : 'landscape';
}

function initBackground() {
    bgStars = [];
    for (let i = 0; i < 80; i++) {
        bgStars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height * 0.5,
            size: Math.random() * 2 + 0.5,
            speed: Math.random() * 0.3 + 0.05,
            brightness: Math.random() * 0.6 + 0.2,
            twinkle: Math.random() * Math.PI * 2
        });
    }
    
    bgClouds = [];
    for (let i = 0; i < 5; i++) {
        bgClouds.push({
            x: Math.random() * canvas.width,
            y: 40 + Math.random() * 80,
            width: 100 + Math.random() * 200,
            speed: 0.2 + Math.random() * 0.3,
            opacity: 0.05 + Math.random() * 0.08
        });
    }
}

function spawnPlatform() {
    const last = platforms[platforms.length - 1];
    const gap = 100 + Math.random() * 160;
    const width = 140 + Math.random() * 180;
    const y = Math.max(groundY - 200, Math.min(groundY - 40, 
        (last ? last.y : groundY - 60) + (Math.random() - 0.5) * 60));
    
    platforms.push({
        x: last ? last.x + last.width + gap : -50,
        y: y,
        width: width,
        height: 16,
        type: Math.random() > 0.6 ? 'ruin' : 'normal',
        collapsing: false,
        collapseTimer: 0,
        shake: 0
    });
}

// ==================== FLYING ROOTS - ADAPTIVE HEIGHTS ====================

function spawnFlyingRoot() {
    const screenType = getScreenType();
    const screenH = canvas.height;
    
    // Calculate reachable heights based on actual screen
    // Single jump reaches about 90-100px up from ground
    // Double jump reaches about 160-180px up from ground
    
    let lowY, midY, highY;
    
    if (screenType === 'portrait') {
        // Portrait: screen is tall but narrow - roots lower
        lowY = groundY - 70 - Math.random() * 30;      // Easy jump
        midY = groundY - 110 - Math.random() * 25;     // Good single jump
        highY = groundY - 150 - Math.random() * 30;    // Double jump
    } else {
        // Landscape: more horizontal space - standard heights
        lowY = groundY - 80 - Math.random() * 30;
        midY = groundY - 130 - Math.random() * 30;
        highY = groundY - 180 - Math.random() * 40;
    }
    
    const heightRoll = Math.random();
    let rootY;
    
    if (heightRoll < 0.35) {
        rootY = lowY;
    } else if (heightRoll < 0.7) {
        rootY = midY;
    } else {
        rootY = highY;
    }
    
    // Clamp: never above top of screen + margin
    rootY = Math.max(60, rootY);
    
    const width = 100 + Math.random() * 120;
    
    flyingRoots.push({
        x: canvas.width + 50,
        y: rootY,
        width: width,
        height: 18,
        baseY: rootY,
        phase: Math.random() * Math.PI * 2,
        speed: 1.2 + Math.random() * 1.8,
        amplitude: 15 + Math.random() * 25,
        moveType: Math.random() > 0.6 ? 'vertical' : 'horizontal',
        horizontalRange: 30 + Math.random() * 60,
        chainSwing: Math.random() * Math.PI * 2,
        rootType: Math.random() > 0.5 ? 'root' : 'rock'
    });
}

// ==================== SPIKES ====================

function spawnSpike() {
    const onPlatform = platforms.length > 0 && Math.random() > 0.3;
    let x, y;
    
    if (onPlatform) {
        const platform = platforms[platforms.length - 1];
        x = platform.x + 20 + Math.random() * (platform.width - 40);
        y = platform.y;
    } else {
        x = canvas.width + 50;
        y = groundY;
    }
    
    spikes.push({
        x: x,
        y: y,
        width: 28,
        height: 32,
        type: Math.random() > 0.6 ? 'tall' : 'wide',
        triggered: false,
        popTimer: 0,
        warningFlash: 0
    });
}

// ==================== COINS ====================

function spawnCoin() {
    const targetRoots = flyingRoots.filter(r => r.x > 50 && r.x < canvas.width - 50);
    const targetPlatforms = platforms.filter(p => p.x > 50 && p.x < canvas.width - 50);
    
    let target;
    if (targetRoots.length > 0 && Math.random() > 0.3) {
        target = targetRoots[Math.floor(Math.random() * targetRoots.length)];
    } else if (targetPlatforms.length > 0) {
        target = targetPlatforms[Math.floor(Math.random() * targetPlatforms.length)];
    } else {
        return;
    }
    
    const count = 3 + Math.floor(Math.random() * 4);
    const startX = target.x + target.width * 0.15;
    const spacing = target.width * 0.7 / count;
    const arcHeight = 40 + Math.random() * 30;
    
    for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        coins.push({
            x: startX + i * spacing,
            y: target.y - 35 - Math.sin(t * Math.PI) * arcHeight,
            radius: 10,
            collected: false,
            bobOffset: Math.random() * Math.PI * 2,
            value: 10,
            glowPhase: Math.random() * Math.PI * 2
        });
    }
}

// ==================== ENEMIES ====================

function spawnEnemy() {
    const isBat = batMode && Math.random() > 0.4;
    
    if (isBat) {
        // Bats at reachable heights
        const batY = groundY - 100 - Math.random() * 80;
        
        enemies.push({
            x: canvas.width + 50,
            y: Math.max(50, batY),
            width: 40,
            height: 30,
            type: 'bat',
            health: 1,
            speed: 2 + Math.random() * 2,
            frame: 0,
            frameTimer: 0,
            dead: false,
            deathTimer: 0,
            wingPhase: Math.random() * Math.PI * 2,
            bobOffset: Math.random() * Math.PI * 2
        });
    } else {
        const chasePlayer = difficultyLevel > 2 && Math.random() > 0.6;
        
        enemies.push({
            x: canvas.width + 50,
            y: groundY,
            width: 40,
            height: 30,
            type: 'monster',
            health: 1,
            speed: 1 + Math.random() * 1.5,
            frame: 0,
            frameTimer: 0,
            dead: false,
            deathTimer: 0,
            chasePlayer: chasePlayer,
            jumpTimer: chasePlayer ? 60 + Math.random() * 60 : -1
        });
    }
}

function createParticles(x, y, color, count, speed = 3) {
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed * (0.5 + Math.random()),
            vy: Math.sin(angle) * speed * (0.5 + Math.random()) - 2,
            life: 25 + Math.random() * 20,
            maxLife: 45,
            color: color,
            size: 2 + Math.random() * 3
        });
    }
}

function doJump() {
    if (!player.jumping && player.grounded && !player.sliding) {
        player.velocityY = jumpPower;
        player.jumping = true;
        player.grounded = false;
        createParticles(player.x + player.width/2, player.y + player.height, '#88ccff', 6, 2);
        return true;
    } else if (player.jumping && !player.doubleJump && !player.grounded && !player.sliding) {
        player.velocityY = jumpPower * 0.65;
        player.doubleJump = true;
        createParticles(player.x + player.width/2, player.y + player.height, '#00d4ff', 10, 3);
        particles.push({
            x: player.x + player.width/2,
            y: player.y + player.height/2,
            vx: 0,
            vy: 0,
            life: 20,
            maxLife: 20,
            color: '#00d4ff',
            size: 30,
            isRing: true
        });
        return true;
    }
    return false;
}

function doSlide() {
    if (!player.sliding && player.grounded && !player.jumping) {
        player.sliding = true;
        player.slideTimer = 35;
        const oldHeight = player.height;
        player.height = 28;
        player.y += oldHeight - player.height;
        createParticles(player.x + player.width/2, player.y + player.height, '#555', 5, 2);
        return true;
    }
    return false;
}

function endSlide() {
    if (player.sliding) {
        player.sliding = false;
        player.y -= 56 - player.height;
        player.height = 56;
    }
}

function doAttack() {
    if (player.attackCooldown <= 0 && !player.sliding) {
        player.attacking = true;
        player.attackTimer = 12;
        player.attackCooldown = 28;
        
        const projX = player.facingRight ? player.x + player.width : player.x - 35;
        const projSpeed = player.facingRight ? 10 : -10;
        
        projectiles.push({
            x: projX,
            y: player.y + player.height/2 - 3,
            width: 35,
            height: 6,
            speed: projSpeed,
            damage: 1,
            isEnemy: false,
            life: 60
        });
        
        createParticles(player.x + player.width/2, player.y + player.height/2, '#00d4ff', 4, 2);
        return true;
    }
    return false;
}

// ==================== UPDATE ====================

function update() {
    if (!gameRunning) return;
    
    groundY = canvas.height - 80;
    
    gameTime += 1/60;
    const mins = Math.floor(gameTime / 60);
    const secs = Math.floor(gameTime % 60);
    document.getElementById('time').textContent = 
        `${mins}:${secs.toString().padStart(2, '0')}`;
    
    difficultyLevel = 1 + Math.floor(gameTime / 30);
    gameSpeed = baseSpeed + Math.min(gameTime / 45, 4);
    
    // Bat mode after 2 minutes
    if (gameTime > 120 && !batMode && !warningShown) {
        warningShown = true;
        const warning = document.getElementById('warningMessage');
        warning.style.opacity = '1';
        setTimeout(() => {
            warning.style.opacity = '0';
            batMode = true;
        }, 4000);
    }
    
    // Slide timer
    if (player.sliding) {
        player.slideTimer--;
        if (player.slideTimer <= 0) endSlide();
    }
    
    // Horizontal movement
    player.x += player.velocityX;
    player.velocityX *= 0.85;
    player.x = Math.max(10, Math.min(canvas.width - player.width - 10, player.x));
    
    // Physics - NO TOP LOCK, only gravity and bottom ground
    player.velocityY += gravity;
    player.y += player.velocityY;
    
    // Bottom ground collision ONLY - no top boundary
    if (player.y >= groundY) {
        player.y = groundY;
        player.velocityY = 0;
        player.grounded = true;
        player.jumping = false;
        player.doubleJump = false;
    } else {
        player.grounded = false;
    }
    
    // Platform collision
    platforms.forEach(p => {
        if (player.velocityY >= 0 &&
            player.x + player.width > p.x + 5 &&
            player.x < p.x + p.width - 5 &&
            player.y + player.height > p.y &&
            player.y + player.height < p.y + p.height + 15) {
            
            if (difficultyLevel > 2 && !p.collapsing && Math.random() < 0.015) {
                p.collapsing = true;
                p.collapseTimer = 40;
            }
            
            if (p.collapsing) {
                p.collapseTimer--;
                p.shake = Math.sin(p.collapseTimer * 0.8) * 3;
                if (p.collapseTimer <= 0) {
                    p.y += 6;
                    if (p.y > canvas.height + 50) p.fallen = true;
                }
            }
            
            if (!p.fallen) {
                player.y = p.y - player.height;
                player.velocityY = 0;
                player.grounded = true;
                player.jumping = false;
                player.doubleJump = false;
            }
        }
    });
    platforms = platforms.filter(p => !p.fallen && p.x + p.width > -100);
    
    // ==================== FLYING ROOTS UPDATE ====================
    flyingRoots.forEach(r => {
        r.x -= gameSpeed;
        r.phase += 0.02 * r.speed;
        r.chainSwing += 0.03;
        
        if (r.moveType === 'vertical') {
            r.y = r.baseY + Math.sin(r.phase) * r.amplitude;
        } else {
            r.x += Math.sin(r.phase) * 0.8;
        }
        
        // Collision with player
        if (player.velocityY >= 0 &&
            player.x + player.width > r.x + 4 &&
            player.x < r.x + r.width - 4 &&
            player.y + player.height > r.y &&
            player.y + player.height < r.y + r.height + 15) {
            
            player.y = r.y - player.height;
            player.velocityY = 0;
            player.grounded = true;
            player.jumping = false;
            player.doubleJump = false;
            
            if (r.moveType === 'horizontal') {
                player.x += Math.sin(r.phase) * 0.8;
            }
        }
    });
    flyingRoots = flyingRoots.filter(r => r.x + r.width > -200);
    
    // Spawn flying roots - GUARANTEED
    const maxRoots = 2 + Math.floor(difficultyLevel / 2);
    if (flyingRoots.length < maxRoots) {
        if (Math.random() < 0.02 || flyingRoots.length === 0) {
            spawnFlyingRoot();
        }
    }
    
    // Spawn regular platforms
    if (platforms.length < 5 || platforms[platforms.length-1].x < canvas.width - 150) {
        spawnPlatform();
    }
    
    // ==================== SPIKES UPDATE ====================
    spikes.forEach(s => {
        s.x -= gameSpeed;
        
        const distToPlayer = Math.abs((s.x + s.width/2) - (player.x + player.width/2));
        if (!s.triggered && distToPlayer < 140 && s.y >= groundY - 10) {
            s.triggered = true;
            s.popTimer = 20;
            s.warningFlash = 10;
        }
        
        if (s.warningFlash > 0) s.warningFlash--;
        
        if (s.triggered && s.popTimer > 0) {
            s.popTimer--;
            s.y -= 2.5;
        }
        
        // Collision
        if (!player.invincible && !player.sliding &&
            player.x < s.x + s.width - 4 &&
            player.x + player.width > s.x + 4 &&
            player.y + player.height > s.y + 8 &&
            player.y < s.y + s.height) {
            
            lives--;
            document.getElementById('lives').textContent = lives;
            player.invincible = true;
            player.invincibleTimer = 50;
            player.velocityY = -5;
            createParticles(player.x + player.width/2, player.y + player.height/2, '#ff3333', 10, 3);
            
            if (lives <= 0) gameOver();
        }
    });
    spikes = spikes.filter(s => s.x > -100);
    
    // Spawn spikes
    const spikeChance = 0.012 + (difficultyLevel * 0.004);
    if (Math.random() < spikeChance) spawnSpike();
    
    // Keyboard
    if (keys['ArrowLeft']) {
        player.velocityX = -moveSpeed;
        player.facingRight = false;
    }
    if (keys['ArrowRight']) {
        player.velocityX = moveSpeed;
        player.facingRight = true;
    }
    if ((keys[' '] || keys['ArrowUp']) && !player.jumping && player.grounded) {
        doJump();
        keys[' '] = false;
        keys['ArrowUp'] = false;
    }
    if (keys['ArrowDown'] && player.grounded && !player.sliding) {
        doSlide();
    }
    if ((keys['z'] || keys['x']) && player.attackCooldown <= 0) {
        doAttack();
        keys['z'] = false;
        keys['x'] = false;
    }
    
    if (player.attackTimer > 0) player.attackTimer--;
    else player.attacking = false;
    if (player.attackCooldown > 0) player.attackCooldown--;
    
    if (player.invincibleTimer > 0) {
        player.invincibleTimer--;
        if (player.invincibleTimer <= 0) player.invincible = false;
    }
    
    player.runTimer++;
    if (player.runTimer > 5) {
        player.runTimer = 0;
        player.runFrame = (player.runFrame + 1) % 4;
    }
    player.capeWave += 0.15;
    
    // Coins
    coins.forEach(coin => {
        coin.x -= gameSpeed;
        coin.bobOffset += 0.08;
        coin.glowPhase += 0.05;
        
        const dx = (player.x + player.width/2) - coin.x;
        const dy = (player.y + player.height/2) - (coin.y + Math.sin(coin.bobOffset) * 5);
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (!coin.collected && dist < coin.radius + player.width/2 + 5) {
            coin.collected = true;
            coinsCollected += coin.value;
            document.getElementById('coins').textContent = coinsCollected;
            createParticles(coin.x, coin.y, '#ffd700', 8, 3);
        }
    });
    coins = coins.filter(c => !c.collected && c.x > -50);
    if (Math.random() < 0.025) spawnCoin();
    
    // Enemies
    enemies.forEach(e => {
        if (e.dead) {
            e.deathTimer++;
            return;
        }
        
        e.x -= gameSpeed + e.speed;
        e.frameTimer++;
        
        if (e.chasePlayer && e.jumpTimer > 0) {
            e.jumpTimer--;
            if (e.jumpTimer <= 0 && e.grounded) {
                e.velocityY = -10;
                e.grounded = false;
                e.jumpTimer = 80 + Math.random() * 60;
            }
        }
        
        if (e.type === 'bat') {
            e.wingPhase += 0.15;
            e.y += Math.sin(e.bobOffset + gameTime * 3) * 0.8;
        }
        
        if (e.frameTimer > 8) {
            e.frameTimer = 0;
            e.frame = (e.frame + 1) % 4;
        }
        
        // Collision
        if (!player.invincible &&
            player.x < e.x + e.width &&
            player.x + player.width > e.x &&
            player.y < e.y + e.height &&
            player.y + player.height > e.y) {
            
            if (player.sliding && e.type === 'bat' && e.y < groundY - 60) {
                // Safe
            }
            else if (player.velocityY > 0 && player.y + player.height < e.y + e.height * 0.6) {
                e.health--;
                player.velocityY = -6;
                createParticles(e.x + e.width/2, e.y, '#ff6644', 6, 2);
                if (e.health <= 0) {
                    e.dead = true;
                    kills++;
                    document.getElementById('kills').textContent = kills;
                    createParticles(e.x + e.width/2, e.y + e.height/2, 
                        e.type === 'bat' ? '#8844ff' : '#44ff44', 15, 4);
                }
            }
            else if (player.attacking) {
                e.health--;
                createParticles(e.x + e.width/2, e.y + e.height/2, '#00d4ff', 5, 2);
                if (e.health <= 0) {
                    e.dead = true;
                    kills++;
                    document.getElementById('kills').textContent = kills;
                    createParticles(e.x + e.width/2, e.y + e.height/2,
                        e.type === 'bat' ? '#8844ff' : '#44ff44', 15, 4);
                }
            }
            else {
                lives--;
                document.getElementById('lives').textContent = lives;
                player.invincible = true;
                player.invincibleTimer = 50;
                player.velocityY = -4;
                createParticles(player.x + player.width/2, player.y + player.height/2, '#ff3333', 10, 3);
                if (lives <= 0) gameOver();
            }
        }
    });
    enemies = enemies.filter(e => !e.dead || e.deathTimer < 25);
    
    const spawnRate = batMode ? 0.025 : 0.015 + (difficultyLevel * 0.003);
    if (Math.random() < spawnRate) spawnEnemy();
    
    // Projectiles
    projectiles.forEach(p => {
        p.x += p.speed;
        p.life--;
        
        if (p.isEnemy) {
            if (!player.invincible &&
                player.x < p.x + p.width &&
                player.x + player.width > p.x &&
                player.y < p.y + p.height &&
                player.y + player.height > p.y) {
                
                if (!(player.sliding && p.y > player.y + player.height/2)) {
                    lives--;
                    document.getElementById('lives').textContent = lives;
                    player.invincible = true;
                    player.invincibleTimer = 50;
                    createParticles(player.x + player.width/2, player.y + player.height/2, '#ff3333', 8, 2);
                    p.hit = true;
                    if (lives <= 0) gameOver();
                }
            }
        } else {
            enemies.forEach(e => {
                if (!e.dead &&
                    p.x < e.x + e.width &&
                    p.x + p.width > e.x &&
                    p.y < e.y + e.height &&
                    p.y + p.height > e.y) {
                    
                    e.health--;
                    p.hit = true;
                    createParticles(p.x, p.y, '#00d4ff', 4, 2);
                    
                    if (e.health <= 0) {
                        e.dead = true;
                        kills++;
                        document.getElementById('kills').textContent = kills;
                        createParticles(e.x + e.width/2, e.y + e.height/2,
                            e.type === 'bat' ? '#8844ff' : '#44ff44', 15, 4);
                    }
                }
            });
            
            spikes.forEach(s => {
                if (p.x < s.x + s.width &&
                    p.x + p.width > s.x &&
                    p.y < s.y + s.height &&
                    p.y + p.height > s.y) {
                    p.hit = true;
                    createParticles(s.x + s.width/2, s.y + s.height/2, '#888', 6, 2);
                    s.x = -200;
                }
            });
        }
    });
    projectiles = projectiles.filter(p => !p.hit && p.life > 0 && p.x > -100 && p.x < canvas.width + 100);
    
    // Particles
    particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
        p.life--;
        if (p.isRing) p.size *= 0.92;
    });
    particles = particles.filter(p => p.life > 0);
    
    // Background
    bgStars.forEach(s => {
        s.x -= s.speed;
        s.twinkle += 0.02;
        if (s.x < 0) s.x = canvas.width;
    });
    
    bgClouds.forEach(c => {
        c.x -= c.speed;
        if (c.x + c.width < 0) c.x = canvas.width + 50;
    });
}

// ==================== DRAW ====================

function drawPlayer(px, py) {
    const flicker = player.invincible && Math.floor(player.invincibleTimer / 3) % 2 === 0;
    if (flicker) ctx.globalAlpha = 0.4;
    
    ctx.save();
    
    if (!player.facingRight) {
        ctx.translate(px + player.width, py);
        ctx.scale(-1, 1);
        px = 0;
        py = 0;
    }
    
    ctx.shadowColor = '#0044aa';
    ctx.shadowBlur = 20;
    
    ctx.fillStyle = '#080810';
    ctx.beginPath();
    if (player.sliding) {
        ctx.ellipse(px + player.width/2, py + player.height/2, 
            player.width/2 + 5, player.height/2, 0, 0, Math.PI * 2);
    } else {
        const bodyBounce = player.grounded ? Math.sin(player.runFrame * Math.PI / 2) * 2 : 0;
        ctx.ellipse(px + player.width/2, py + player.height/2 - bodyBounce, 
            player.width/2, player.height/2 - 2, 0, 0, Math.PI * 2);
    }
    ctx.fill();
    
    ctx.strokeStyle = '#001133';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
    
    if (!player.sliding) {
        ctx.fillStyle = '#0a0a18';
        ctx.beginPath();
        const capeX = px - 5;
        const capeY = py + 10;
        const wave = Math.sin(player.capeWave + player.runFrame) * 8;
        ctx.moveTo(capeX, capeY);
        ctx.quadraticCurveTo(capeX - 25 + wave, capeY + 15, capeX - 15 + wave * 0.5, capeY + 35);
        ctx.quadraticCurveTo(capeX + 5, capeY + 30, capeX + 8, capeY + 15);
        ctx.closePath();
        ctx.fill();
    }
    
    ctx.fillStyle = '#00d4ff';
    ctx.shadowColor = '#00d4ff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(px + 10, py + 14, 3, 0, Math.PI * 2);
    ctx.arc(px + 22, py + 14, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    if (player.attacking) {
        ctx.strokeStyle = '#00d4ff';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#00d4ff';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(px + player.width/2, py + player.height/2, 45, -Math.PI/4, Math.PI/4);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(px + player.width/2, py + player.height/2, 50, -Math.PI/3, Math.PI/3);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }
    
    if (player.grounded && !player.sliding) {
        ctx.fillStyle = '#060610';
        const legOffset = Math.sin(player.runFrame * Math.PI / 2) * 10;
        ctx.fillRect(px + 6, py + player.height - 8, 10, 12 + legOffset);
        ctx.fillRect(px + player.width - 16, py + player.height - 8, 10, 12 - legOffset);
    } else if (!player.sliding) {
        ctx.fillStyle = '#060610';
        ctx.fillRect(px + 6, py + player.height - 8, 10, 10);
        ctx.fillRect(px + player.width - 16, py + player.height - 8, 10, 10);
    }
    
    if (player.sliding) {
        ctx.fillStyle = 'rgba(100, 100, 120, 0.4)';
        ctx.beginPath();
        ctx.arc(px - 15, py + player.height - 5, 6, 0, Math.PI * 2);
        ctx.arc(px - 25, py + player.height - 8, 4, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.restore();
    ctx.globalAlpha = 1;
}

function drawEnemy(e) {
    if (e.dead) {
        ctx.globalAlpha = Math.max(0, 1 - e.deathTimer / 25);
    }
    
    ctx.save();
    
    if (e.type === 'bat') {
        ctx.shadowColor = '#6622aa';
        ctx.shadowBlur = 12;
        
        ctx.fillStyle = '#1a0a2e';
        ctx.beginPath();
        ctx.ellipse(e.x + e.width/2, e.y + e.height/2, e.width/3, e.height/3, 0, 0, Math.PI * 2);
        ctx.fill();
        
        const wingFlap = Math.sin(e.wingPhase) * 12;
        ctx.fillStyle = '#140820';
        ctx.beginPath();
        ctx.moveTo(e.x + e.width/2, e.y + 5);
        ctx.quadraticCurveTo(e.x - 15, e.y - 15 + wingFlap, e.x + 5, e.y + 10);
        ctx.quadraticCurveTo(e.x + e.width/2, e.y + 15, e.x + e.width/2, e.y + 5);
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(e.x + e.width/2, e.y + 5);
        ctx.quadraticCurveTo(e.x + e.width + 15, e.y - 15 + wingFlap, e.x + e.width - 5, e.y + 10);
        ctx.quadraticCurveTo(e.x + e.width/2, e.y + 15, e.x + e.width/2, e.y + 5);
        ctx.fill();
        
        ctx.fillStyle = '#aa44ff';
        ctx.shadowColor = '#aa44ff';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(e.x + 12, e.y + 12, 3, 0, Math.PI * 2);
        ctx.arc(e.x + e.width - 12, e.y + 12, 3, 0, Math.PI * 2);
        ctx.fill();
        
    } else {
        ctx.shadowColor = '#224422';
        ctx.shadowBlur = 8;
        
        ctx.fillStyle = '#0f1f0f';
        ctx.fillRect(e.x + 5, e.y + 8, e.width - 10, e.height - 8);
        
        ctx.fillStyle = '#051005';
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(e.x + 6 + i * 12, e.y + 8);
            ctx.lineTo(e.x + 12 + i * 12, e.y - 6);
            ctx.lineTo(e.x + 18 + i * 12, e.y + 8);
            ctx.fill();
        }
        
        ctx.fillStyle = '#ff0000';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(e.x + 10, e.y + 18, 4, 0, Math.PI * 2);
        ctx.arc(e.x + e.width - 10, e.y + 18, 4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#000';
        ctx.shadowBlur = 0;
        ctx.fillRect(e.x + 8, e.y + 26, e.width - 16, 5);
    }
    
    ctx.shadowBlur = 0;
    ctx.restore();
    ctx.globalAlpha = 1;
}

function drawSpike(s) {
    ctx.save();
    
    if (s.warningFlash > 0) {
        ctx.fillStyle = `rgba(255, 50, 50, ${s.warningFlash / 20})`;
        ctx.beginPath();
        ctx.arc(s.x + s.width/2, s.y + s.height/2, 25, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = s.triggered ? 10 : 4;
    
    if (s.type === 'tall') {
        ctx.fillStyle = '#330000';
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(s.x + 4 + i * 9, s.y + s.height);
            ctx.lineTo(s.x + 8 + i * 9, s.y);
            ctx.lineTo(s.x + 12 + i * 9, s.y + s.height);
            ctx.fill();
        }
    } else {
        ctx.fillStyle = '#220000';
        ctx.beginPath();
        ctx.moveTo(s.x, s.y + s.height);
        ctx.lineTo(s.x + s.width * 0.2, s.y);
        ctx.lineTo(s.x + s.width * 0.5, s.y + s.height * 0.3);
        ctx.lineTo(s.x + s.width * 0.8, s.y);
        ctx.lineTo(s.x + s.width, s.y + s.height);
        ctx.fill();
    }
    
    ctx.shadowBlur = 0;
    ctx.restore();
}

function drawFlyingRoot(r) {
    ctx.save();
    
    const swing = Math.sin(r.chainSwing) * 6;
    
    // Chain from top of screen
    ctx.strokeStyle = '#2a2a3a';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(r.x + r.width/2 + swing, -10);
    ctx.lineTo(r.x + r.width/2 + swing * 0.5, r.y);
    ctx.stroke();
    ctx.setLineDash([]);
    
    if (r.rootType === 'root') {
        ctx.shadowColor = '#4a3728';
        ctx.shadowBlur = 15;
        
        ctx.fillStyle = '#2a1f15';
        ctx.beginPath();
        ctx.moveTo(r.x, r.y + r.height);
        ctx.lineTo(r.x + 5, r.y);
        ctx.quadraticCurveTo(r.x + r.width * 0.3, r.y - 5, r.x + r.width * 0.5, r.y + 2);
        ctx.quadraticCurveTo(r.x + r.width * 0.7, r.y - 3, r.x + r.width - 5, r.y);
        ctx.lineTo(r.x + r.width, r.y + r.height);
        ctx.closePath();
        ctx.fill();
        
        ctx.strokeStyle = '#1a120a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(r.x + 10, r.y + r.height);
        ctx.lineTo(r.x + 15, r.y + 5);
        ctx.moveTo(r.x + r.width - 10, r.y + r.height);
        ctx.lineTo(r.x + r.width - 15, r.y + 5);
        ctx.moveTo(r.x + r.width * 0.5, r.y + r.height);
        ctx.lineTo(r.x + r.width * 0.5, r.y + 3);
        ctx.stroke();
        
        ctx.fillStyle = '#3a5530';
        ctx.fillRect(r.x + 8, r.y, r.width - 16, 4);
        
        ctx.fillStyle = '#1a120a';
        for (let i = 0; i < 3; i++) {
            const hangX = r.x + 15 + i * (r.width - 30) / 2;
            ctx.beginPath();
            ctx.moveTo(hangX, r.y + r.height);
            ctx.quadraticCurveTo(hangX + 3 + swing * 0.3, r.y + r.height + 12, hangX - 2, r.y + r.height + 18);
            ctx.stroke();
        }
        
    } else {
        ctx.shadowColor = '#334455';
        ctx.shadowBlur = 15;
        
        ctx.fillStyle = '#1a2530';
        ctx.beginPath();
        ctx.moveTo(r.x + 5, r.y + r.height);
        ctx.lineTo(r.x, r.y + r.height * 0.5);
        ctx.lineTo(r.x + 8, r.y + 3);
        ctx.lineTo(r.x + r.width * 0.4, r.y);
        ctx.lineTo(r.x + r.width * 0.6, r.y + 2);
        ctx.lineTo(r.x + r.width - 8, r.y + 4);
        ctx.lineTo(r.x + r.width, r.y + r.height * 0.5);
        ctx.lineTo(r.x + r.width - 5, r.y + r.height);
        ctx.closePath();
        ctx.fill();
        
        ctx.strokeStyle = '#0f1a25';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(r.x + r.width * 0.3, r.y + 5);
        ctx.lineTo(r.x + r.width * 0.5, r.y + r.height * 0.5);
        ctx.lineTo(r.x + r.width * 0.7, r.y + 8);
        ctx.moveTo(r.x + r.width * 0.2, r.y + r.height * 0.6);
        ctx.lineTo(r.x + r.width * 0.4, r.y + r.height * 0.4);
        ctx.stroke();
        
        ctx.fillStyle = '#2a3a45';
        ctx.fillRect(r.x + 10, r.y, r.width - 20, 3);
        
        ctx.fillStyle = '#4488aa';
        ctx.shadowColor = '#4488aa';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(r.x + r.width * 0.7, r.y + 5);
        ctx.lineTo(r.x + r.width * 0.8, r.y - 8);
        ctx.lineTo(r.x + r.width * 0.85, r.y + 3);
        ctx.closePath();
        ctx.fill();
    }
    
    ctx.fillStyle = 'rgba(150, 200, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(r.x + Math.sin(r.phase * 3) * 15, r.y - 10, 2, 0, Math.PI * 2);
    ctx.arc(r.x + r.width + Math.cos(r.phase * 2) * 12, r.y - 15, 1.5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.shadowBlur = 0;
    ctx.restore();
}

function draw() {
    // Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    skyGrad.addColorStop(0, '#050510');
    skyGrad.addColorStop(0.4, '#0a0a1e');
    skyGrad.addColorStop(0.7, '#0f0f28');
    skyGrad.addColorStop(1, '#1a1a3e');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Moon
    ctx.save();
    ctx.shadowColor = '#ccddff';
    ctx.shadowBlur = 40;
    ctx.fillStyle = '#ddeeff';
    ctx.beginPath();
    ctx.arc(canvas.width * 0.75, canvas.height * 0.18, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ccddee';
    ctx.beginPath();
    ctx.arc(canvas.width * 0.75 - 6, canvas.height * 0.18 + 4, 6, 0, Math.PI * 2);
    ctx.arc(canvas.width * 0.75 + 8, canvas.height * 0.18 - 6, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    
    // Distant castle
    ctx.fillStyle = '#080818';
    ctx.beginPath();
    const castleX = canvas.width * 0.55;
    const castleY = groundY + 56;
    ctx.moveTo(castleX, castleY);
    ctx.lineTo(castleX + 8, castleY - 50);
    ctx.lineTo(castleX + 16, castleY - 38);
    ctx.lineTo(castleX + 24, castleY - 65);
    ctx.lineTo(castleX + 36, castleY - 42);
    ctx.lineTo(castleX + 44, castleY - 58);
    ctx.lineTo(castleX + 56, castleY - 35);
    ctx.lineTo(castleX + 64, castleY - 48);
    ctx.lineTo(castleX + 76, castleY);
    ctx.closePath();
    ctx.fill();
    
    ctx.fillStyle = '#ff4400';
    ctx.shadowColor = '#ff4400';
    ctx.shadowBlur = 6;
    ctx.fillRect(castleX + 26, castleY - 50, 2, 4);
    ctx.fillRect(castleX + 34, castleY - 38, 2, 4);
    ctx.fillRect(castleX + 50, castleY - 48, 2, 4);
    ctx.shadowBlur = 0;
    
    // Clouds
    bgClouds.forEach(c => {
        ctx.fillStyle = `rgba(20, 20, 40, ${c.opacity})`;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, c.width/2, 12, 0, 0, Math.PI * 2);
        ctx.fill();
    });
    
    // Stars
    bgStars.forEach(s => {
        const twinkle = 0.5 + Math.sin(s.twinkle) * 0.3;
        ctx.fillStyle = `rgba(200, 220, 255, ${s.brightness * twinkle})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
    });
    
    // Ground
    ctx.fillStyle = '#0a0a18';
    ctx.fillRect(0, groundY + 56, canvas.width, canvas.height - groundY - 56);
    
    ctx.strokeStyle = '#1a1a3e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY + 56);
    ctx.lineTo(canvas.width, groundY + 56);
    ctx.stroke();
    
    ctx.strokeStyle = '#111122';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 150) {
        ctx.beginPath();
        ctx.moveTo(i, groundY + 56);
        ctx.lineTo(i + 15, groundY + 56 + 25);
        ctx.lineTo(i + 30, groundY + 56 + 12);
        ctx.stroke();
    }
    
    // Flying roots
    flyingRoots.forEach(r => drawFlyingRoot(r));
    
    // Platforms
    platforms.forEach(p => {
        ctx.save();
        
        if (p.shake) {
            ctx.translate(Math.random() * p.shake - p.shake/2, 0);
        }
        
        ctx.fillStyle = '#121225';
        ctx.fillRect(p.x, p.y, p.width, p.height);
        ctx.fillStyle = '#1a2a4a';
        ctx.fillRect(p.x, p.y, p.width, 3);
        
        if (p.type === 'ruin') {
            ctx.strokeStyle = '#222244';
            ctx.lineWidth = 3;
            ctx.beginPath();
            for (let i = 0; i < p.width; i += 20) {
                ctx.moveTo(p.x + i, p.y + 6);
                ctx.lineTo(p.x + i + 10, p.y + 6);
                ctx.arc(p.x + i + 10, p.y + 6, 3, 0, Math.PI);
            }
            ctx.stroke();
        }
        
        if (p.collapsing) {
            ctx.strokeStyle = '#ff4444';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(p.x + p.width * 0.3, p.y);
            ctx.lineTo(p.x + p.width * 0.5, p.y + p.height);
            ctx.moveTo(p.x + p.width * 0.7, p.y);
            ctx.lineTo(p.x + p.width * 0.5, p.y + p.height);
            ctx.stroke();
        }
        
        ctx.fillStyle = '#0a0a15';
        for (let i = 10; i < p.width - 10; i += 25) {
            if (Math.random() > 0.5) {
                ctx.beginPath();
                ctx.moveTo(p.x + i, p.y + p.height);
                ctx.lineTo(p.x + i + 5, p.y + p.height + 10);
                ctx.lineTo(p.x + i + 10, p.y + p.height);
                ctx.fill();
            }
        }
        
        ctx.restore();
    });
    
    // Spikes
    spikes.forEach(s => drawSpike(s));
    
    // Coins
    coins.forEach(coin => {
        const bobY = Math.sin(coin.bobOffset) * 5;
        const glow = 0.7 + Math.sin(coin.glowPhase) * 0.3;
        
        ctx.save();
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 15 * glow;
        ctx.fillStyle = `rgba(255, 215, 0, ${0.3 * glow})`;
        ctx.beginPath();
        ctx.arc(coin.x, coin.y + bobY, coin.radius + 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(coin.x, coin.y + bobY, coin.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffee88';
        ctx.beginPath();
        ctx.arc(coin.x - 2, coin.y + bobY - 2, coin.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
    
    // Enemies
    enemies.forEach(e => drawEnemy(e));
    
    // Projectiles
    projectiles.forEach(p => {
        if (p.isEnemy) {
            ctx.save();
            ctx.shadowColor = '#ff4400';
            ctx.shadowBlur = 15;
            ctx.fillStyle = '#ff6600';
            ctx.beginPath();
            ctx.arc(p.x + p.width/2, p.y + p.height/2, p.height/2 + 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffcc00';
            ctx.beginPath();
            ctx.arc(p.x + p.width/2, p.y + p.height/2, p.height/3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255, 100, 0, 0.3)';
            ctx.beginPath();
            ctx.arc(p.x + p.width/2 + 8, p.y + p.height/2, p.height/2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        } else {
            ctx.save();
            ctx.shadowColor = '#00d4ff';
            ctx.shadowBlur = 12;
            ctx.fillStyle = '#00d4ff';
            ctx.fillRect(p.x, p.y, p.width, p.height);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(p.x + (p.speed > 0 ? p.width - 8 : 0), p.y - 1, 6, p.height + 2);
            ctx.restore();
        }
    });
    
    // Player
    drawPlayer(player.x, player.y);
    
    // Particles
    particles.forEach(p => {
        const alpha = p.life / p.maxLife;
        if (p.isRing) {
            ctx.strokeStyle = `rgba(0, 212, 255, ${alpha * 0.5})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
            ctx.fill();
        }
    });
    ctx.globalAlpha = 1;
    
    // Bat mode overlay
    if (batMode) {
        ctx.fillStyle = 'rgba(60, 0, 80, 0.06)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Difficulty indicator
    if (difficultyLevel > 1) {
        ctx.fillStyle = `rgba(255, 50, 50, ${0.03 * difficultyLevel})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

// ==================== GAME LOOP ====================

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

function startGame() {
    document.getElementById('startScreen').style.display = 'none';
    gameRunning = true;
    initGame();
}

function initGame() {
    score = 0;
    coinsCollected = 0;
    kills = 0;
    lives = 3;
    gameTime = 0;
    batMode = false;
    warningShown = false;
    difficultyLevel = 1;
    gameSpeed = baseSpeed;
    
    player.x = canvas.width * 0.15;
    player.y = groundY;
    player.velocityY = 0;
    player.velocityX = 0;
    player.jumping = false;
    player.doubleJump = false;
    player.grounded = true;
    player.sliding = false;
    player.slideTimer = 0;
    player.height = 56;
    player.invincible = false;
    player.facingRight = true;
    
    platforms = [];
    flyingRoots = [];
    coins = [];
    enemies = [];
    spikes = [];
    particles = [];
    projectiles = [];
    
    initBackground();
    
    // Spawn initial flying roots - spread across screen
    for (let i = 0; i < 2; i++) {
        spawnFlyingRoot();
        flyingRoots[i].x = canvas.width * 0.3 + i * 200;
    }
    
    document.getElementById('coins').textContent = '0';
    document.getElementById('kills').textContent = '0';
    document.getElementById('lives').textContent = '3';
    document.getElementById('time').textContent = '0:00';
    document.getElementById('warningMessage').style.opacity = '0';
}

function gameOver() {
    gameRunning = false;
    const finalScore = coinsCollected + (kills * 25) + Math.floor(gameTime);
    document.getElementById('finalScore').textContent = finalScore;
    document.getElementById('gameOverScreen').style.display = 'flex';
}

function restartGame() {
    document.getElementById('gameOverScreen').style.display = 'none';
    gameRunning = true;
    initGame();
}

// ==================== INPUT ====================

document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!gameRunning) return;
    
    const touch = e.touches[0];
    const now = Date.now();
    
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    isTouching = true;
    
    const timeSinceLastTap = now - lastTapTime;
    if (timeSinceLastTap < 350 && timeSinceLastTap > 50) {
        doJump();
    }
    
    lastTapTime = now;
    
}, {passive: false});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!gameRunning || !isTouching) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    
    if (Math.abs(deltaX) > 15) {
        player.velocityX = (deltaX > 0 ? moveSpeed : -moveSpeed);
        player.facingRight = deltaX > 0;
        touchStartX = touch.clientX;
    }
    
    if (deltaY > 50 && Math.abs(deltaX) < 40) {
        doSlide();
        touchStartY = touch.clientY;
    }
    
}, {passive: false});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    const tapDuration = Date.now() - lastTapTime;
    
    if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10 && tapDuration < 200) {
        doJump();
    }
    
    isTouching = false;
    player.velocityX *= 0.5;
    
}, {passive: false});

const btnAttack = document.getElementById('btnAttack');

function onAttackPress(e) {
    e.preventDefault();
    e.stopPropagation();
    if (gameRunning) doAttack();
    btnAttack.classList.add('pressed');
}

function onAttackRelease(e) {
    e.preventDefault();
    btnAttack.classList.remove('pressed');
}

btnAttack.addEventListener('touchstart', onAttackPress, {passive: false});
btnAttack.addEventListener('touchend', onAttackRelease, {passive: false});
btnAttack.addEventListener('touchcancel', onAttackRelease, {passive: false});
btnAttack.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (gameRunning) doAttack();
    btnAttack.classList.add('pressed');
});
btnAttack.addEventListener('mouseup', () => btnAttack.classList.remove('pressed'));
btnAttack.addEventListener('mouseleave', () => btnAttack.classList.remove('pressed'));

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', restartGame);

document.addEventListener('touchmove', (e) => {
    if (e.target === canvas || e.target === btnAttack) {
        e.preventDefault();
    }
}, {passive: false});

document.addEventListener('contextmenu', (e) => e.preventDefault());

initBackground();
gameLoop();
