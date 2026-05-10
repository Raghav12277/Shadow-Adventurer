const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size
        function resizeCanvas() {
            const container = document.getElementById('gameContainer');
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;
        }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        
        // Game state
        let gameRunning = false;
        let score = 0;
        let lives = 3;
        let gameTime = 0;
        let dragonMode = false;
        let warningShown = false;
        let isMobile = window.innerWidth <= 768;
        
        // Game speed
        let baseSpeed = 4;
        let gameSpeed = baseSpeed;
        
        // Player
        const player = {
            x: 100,
            y: 350,
            width: 40,
            height: 60,
            velocityY: 0,
            jumping: false,
            doubleJump: false,
            grounded: false,
            attacking: false,
            attackTimer: 0,
            attackCooldown: 0,
            invincible: false,
            invincibleTimer: 0,
            facingRight: true,
            runFrame: 0,
            runTimer: 0
        };
        
        // Physics
        const gravity = 0.6;
        const jumpPower = -14;
        let groundY = 350;
        
        // Arrays for game objects
        let platforms = [];
        let coins = [];
        let monsters = [];
        let particles = [];
        let projectiles = [];
        let backgroundElements = [];
        
        // Input
        const keys = {};
        let touchStartY = 0;
        let touchStartTime = 0;
        
        // Initialize background elements
        function initBackground() {
            backgroundElements = [];
            for (let i = 0; i < 50; i++) {
                backgroundElements.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height * 0.6,
                    size: Math.random() * 3 + 1,
                    speed: Math.random() * 0.5 + 0.1,
                    brightness: Math.random() * 0.5 + 0.3
                });
            }
        }
        
        // Spawn platform
        function spawnPlatform() {
            const lastPlatform = platforms[platforms.length - 1];
            const minGap = 80;
            const maxGap = 200;
            const gap = minGap + Math.random() * (maxGap - minGap);
            
            const width = 100 + Math.random() * 150;
            const height = 20;
            const y = 250 + Math.random() * 150;
            
            platforms.push({
                x: lastPlatform ? lastPlatform.x + lastPlatform.width + gap : 0,
                y: y,
                width: width,
                height: height,
                passed: false
            });
        }
        
        // Spawn coin
        function spawnCoin() {
            const platform = platforms[Math.floor(Math.random() * platforms.length)];
            if (!platform) return;
            
            coins.push({
                x: platform.x + Math.random() * platform.width,
                y: platform.y - 40 - Math.random() * 100,
                width: 25,
                height: 25,
                collected: false,
                bobOffset: Math.random() * Math.PI * 2,
                value: 10
            });
        }
        
        // Spawn monster
        function spawnMonster() {
            const type = dragonMode ? 'dragon' : 'monster';
            const y = dragonMode ? 100 + Math.random() * 200 : groundY - 40;
            
            monsters.push({
                x: canvas.width + 50,
                y: y,
                width: dragonMode ? 70 : 50,
                height: dragonMode ? 60 : 50,
                type: type,
                health: dragonMode ? 3 : 1,
                speed: dragonMode ? 2 + Math.random() * 2 : 1 + Math.random() * 2,
                frame: 0,
                frameTimer: 0,
                dead: false,
                deathTimer: 0,
                shootTimer: dragonMode ? 0 : -1
            });
        }
        
        // Create particle effect
        function createParticles(x, y, color, count, speed = 3) {
            for (let i = 0; i < count; i++) {
                particles.push({
                    x: x,
                    y: y,
                    vx: (Math.random() - 0.5) * speed * 2,
                    vy: (Math.random() - 0.5) * speed * 2 - 2,
                    life: 30 + Math.random() * 20,
                    color: color,
                    size: Math.random() * 4 + 2
                });
            }
        }
        
        // Jump function
        function doJump() {
            if (!player.jumping && player.grounded) {
                player.velocityY = jumpPower;
                player.jumping = true;
                player.grounded = false;
                createParticles(player.x + player.width/2, player.y + player.height, '#fff', 5);
            } else if (player.jumping && !player.doubleJump && !player.grounded) {
                player.velocityY = jumpPower * 0.8;
                player.doubleJump = true;
                createParticles(player.x + player.width/2, player.y + player.height, '#00d4ff', 8);
            }
        }
        
        // Fast fall function
        function doFastFall() {
            if (!player.grounded) {
                player.velocityY += 5;
            }
        }
        
        // Attack function
        function doAttack() {
            if (player.attackCooldown <= 0) {
                player.attacking = true;
                player.attackTimer = 15;
                player.attackCooldown = 30;
                
                projectiles.push({
                    x: player.x + player.width,
                    y: player.y + player.height/2,
                    width: 30,
                    height: 10,
                    speed: 8,
                    damage: 1
                });
                
                createParticles(player.x + player.width, player.y + player.height/2, '#ff0', 3);
            }
        }
        
        // Update game
        function update() {
            if (!gameRunning) return;
            
            groundY = canvas.height - 150;
            
            // Update time
            gameTime += 1/60;
            const minutes = Math.floor(gameTime / 60);
            const seconds = Math.floor(gameTime % 60);
            document.getElementById('time').textContent = 
                `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            // Check dragon transformation (after 2 minutes)
            if (gameTime > 120 && !dragonMode && !warningShown) {
                warningShown = true;
                const warning = document.getElementById('warningMessage');
                warning.style.opacity = '1';
                setTimeout(() => {
                    warning.style.opacity = '0';
                    dragonMode = true;
                }, 3000);
            }
            
            // Increase difficulty
            gameSpeed = baseSpeed + Math.floor(gameTime / 30) * 0.5;
            
            // Player physics
            player.velocityY += gravity;
            player.y += player.velocityY;
            
            // Ground collision
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
            platforms.forEach(platform => {
                if (player.x + player.width > platform.x &&
                    player.x < platform.x + platform.width &&
                    player.y + player.height > platform.y &&
                    player.y + player.height < platform.y + platform.height + 20 &&
                    player.velocityY >= 0) {
                    player.y = platform.y - player.height;
                    player.velocityY = 0;
                    player.grounded = true;
                    player.jumping = false;
                    player.doubleJump = false;
                }
            });
            
            // Keyboard controls
            if ((keys[' '] || keys['ArrowUp']) && !player.jumping && player.grounded) {
                doJump();
            } else if ((keys[' '] || keys['ArrowUp']) && player.jumping && !player.doubleJump && !player.grounded) {
                doJump();
            }
            
            if (keys['ArrowDown'] && !player.grounded) {
                doFastFall();
            }
            
            if ((keys['z'] || keys['x']) && player.attackCooldown <= 0) {
                doAttack();
            }
            
            if (player.attackTimer > 0) player.attackTimer--;
            else player.attacking = false;
            if (player.attackCooldown > 0) player.attackCooldown--;
            
            // Invincibility
            if (player.invincibleTimer > 0) {
                player.invincibleTimer--;
                if (player.invincibleTimer <= 0) player.invincible = false;
            }
            
            // Animation
            player.runTimer++;
            if (player.runTimer > 6) {
                player.runTimer = 0;
                player.runFrame = (player.runFrame + 1) % 4;
            }
            
            // Update platforms
            platforms.forEach(p => p.x -= gameSpeed);
            platforms = platforms.filter(p => p.x + p.width > -100);
            
            // Spawn new platforms
            if (platforms.length < 5 || platforms[platforms.length-1].x < canvas.width - 200) {
                spawnPlatform();
            }
            
            // Update coins
            coins.forEach(coin => {
                coin.x -= gameSpeed;
                coin.bobOffset += 0.1;
                
                if (!coin.collected &&
                    player.x < coin.x + coin.width &&
                    player.x + player.width > coin.x &&
                    player.y < coin.y + coin.height &&
                    player.y + player.height > coin.y) {
                    coin.collected = true;
                    score += coin.value;
                    document.getElementById('score').textContent = score;
                    createParticles(coin.x + coin.width/2, coin.y + coin.height/2, '#ffd700', 10);
                }
            });
            coins = coins.filter(c => !c.collected && c.x > -50);
            
            if (Math.random() < 0.02) spawnCoin();
            
            // Update monsters
            monsters.forEach(monster => {
                if (monster.dead) {
                    monster.deathTimer++;
                    return;
                }
                
                monster.x -= gameSpeed + monster.speed;
                monster.frameTimer++;
                if (monster.frameTimer > 10) {
                    monster.frameTimer = 0;
                    monster.frame = (monster.frame + 1) % 4;
                }
                
                if (monster.type === 'dragon' && monster.shootTimer >= 0) {
                    monster.shootTimer++;
                    if (monster.shootTimer > 120) {
                        monster.shootTimer = 0;
                        projectiles.push({
                            x: monster.x,
                            y: monster.y + monster.height/2,
                            width: 40,
                            height: 20,
                            speed: -5,
                            damage: 1,
                            isEnemy: true,
                            color: '#ff4400'
                        });
                    }
                }
                
                if (!player.invincible &&
                    player.x < monster.x + monster.width &&
                    player.x + player.width > monster.x &&
                    player.y < monster.y + monster.height &&
                    player.y + player.height > monster.y) {
                    
                    if (player.attacking || player.velocityY > 0 && player.y < monster.y) {
                        monster.health--;
                        if (monster.health <= 0) {
                            monster.dead = true;
                            score += monster.type === 'dragon' ? 50 : 20;
                            document.getElementById('score').textContent = score;
                            createParticles(monster.x + monster.width/2, monster.y + monster.height/2, 
                                monster.type === 'dragon' ? '#ff4400' : '#0f0', 15);
                            player.velocityY = -8;
                        } else {
                            player.velocityY = -5;
                        }
                    } else {
                        lives--;
                        document.getElementById('lives').textContent = lives;
                        player.invincible = true;
                        player.invincibleTimer = 60;
                        player.velocityY = -5;
                        createParticles(player.x + player.width/2, player.y + player.height/2, '#f00', 10);
                        
                        if (lives <= 0) gameOver();
                    }
                }
            });
            monsters = monsters.filter(m => !m.dead || m.deathTimer < 30);
            
            const spawnRate = dragonMode ? 0.015 : 0.02;
            if (Math.random() < spawnRate) spawnMonster();
            
            // Update projectiles
            projectiles.forEach(proj => {
                proj.x += proj.speed;
                
                if (proj.isEnemy &&
                    !player.invincible &&
                    player.x < proj.x + proj.width &&
                    player.x + player.width > proj.x &&
                    player.y < proj.y + proj.height &&
                    player.y + player.height > proj.y) {
                    
                    lives--;
                    document.getElementById('lives').textContent = lives;
                    player.invincible = true;
                    player.invincibleTimer = 60;
                    createParticles(player.x + player.width/2, player.y + player.height/2, '#f00', 10);
                    proj.hit = true;
                    
                    if (lives <= 0) gameOver();
                }
                
                if (!proj.isEnemy) {
                    monsters.forEach(monster => {
                        if (!monster.dead &&
                            proj.x < monster.x + monster.width &&
                            proj.x + proj.width > monster.x &&
                            proj.y < monster.y + monster.height &&
                            proj.y + proj.height > monster.y) {
                            
                            monster.health--;
                            proj.hit = true;
                            createParticles(proj.x, proj.y, '#ff0', 5);
                            
                            if (monster.health <= 0) {
                                monster.dead = true;
                                score += monster.type === 'dragon' ? 50 : 20;
                                document.getElementById('score').textContent = score;
                                createParticles(monster.x + monster.width/2, monster.y + monster.height/2,
                                    monster.type === 'dragon' ? '#ff4400' : '#0f0', 15);
                            }
                        }
                    });
                }
            });
            projectiles = projectiles.filter(p => !p.hit && p.x > -100 && p.x < canvas.width + 100);
            
            // Update particles
            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.1;
                p.life--;
            });
            particles = particles.filter(p => p.life > 0);
            
            // Update background
            backgroundElements.forEach(star => {
                star.x -= star.speed;
                if (star.x < 0) star.x = canvas.width;
            });
        }
        
        // Draw game
        function draw() {
            ctx.fillStyle = '#0a0a1a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            backgroundElements.forEach(star => {
                ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness})`;
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
                ctx.fill();
            });
            
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(0, groundY + player.height, canvas.width, canvas.height - groundY - player.height);
            
            ctx.strokeStyle = '#2a2a4e';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, groundY + player.height);
            ctx.lineTo(canvas.width, groundY + player.height);
            ctx.stroke();
            
            platforms.forEach(p => {
                ctx.fillStyle = '#2d4a6f';
                ctx.fillRect(p.x, p.y, p.width, p.height);
                ctx.fillStyle = '#4a7fb5';
                ctx.fillRect(p.x, p.y, p.width, 4);
                ctx.fillStyle = '#1a3a5c';
                for (let i = 0; i < p.width; i += 20) {
                    ctx.fillRect(p.x + i, p.y + 8, 15, 4);
                }
            });
            
            coins.forEach(coin => {
                const bobY = Math.sin(coin.bobOffset) * 5;
                ctx.shadowColor = '#ffd700';
                ctx.shadowBlur = 15;
                ctx.fillStyle = '#ffd700';
                ctx.beginPath();
                ctx.arc(coin.x + coin.width/2, coin.y + coin.height/2 + bobY, coin.width/2, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ffed4e';
                ctx.beginPath();
                ctx.arc(coin.x + coin.width/2, coin.y + coin.height/2 + bobY, coin.width/3, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            });
            
            monsters.forEach(monster => {
                if (monster.dead) {
                    ctx.globalAlpha = 1 - monster.deathTimer / 30;
                }
                
                if (monster.type === 'dragon') {
                    ctx.fillStyle = '#8b0000';
                    ctx.fillRect(monster.x, monster.y, monster.width, monster.height);
                    ctx.fillStyle = '#660000';
                    const wingOffset = Math.sin(monster.frame * 0.5) * 10;
                    ctx.beginPath();
                    ctx.moveTo(monster.x + monster.width/2, monster.y);
                    ctx.lineTo(monster.x - 10, monster.y - 20 + wingOffset);
                    ctx.lineTo(monster.x + monster.width/2, monster.y + 10);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.moveTo(monster.x + monster.width/2, monster.y);
                    ctx.lineTo(monster.x + monster.width + 10, monster.y - 20 + wingOffset);
                    ctx.lineTo(monster.x + monster.width/2, monster.y + 10);
                    ctx.fill();
                    ctx.fillStyle = '#ff4400';
                    ctx.beginPath();
                    ctx.arc(monster.x + 15, monster.y + 20, 5, 0, Math.PI * 2);
                    ctx.arc(monster.x + monster.width - 15, monster.y + 20, 5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowColor = '#ff4400';
                    ctx.shadowBlur = 20;
                    ctx.fillStyle = '#ff6600';
                    ctx.beginPath();
                    ctx.arc(monster.x, monster.y + monster.height/2, 8, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                } else {
                    ctx.fillStyle = '#2d5016';
                    ctx.fillRect(monster.x, monster.y, monster.width, monster.height);
                    ctx.fillStyle = '#1a3009';
                    for (let i = 0; i < 3; i++) {
                        ctx.beginPath();
                        ctx.moveTo(monster.x + i * 20, monster.y);
                        ctx.lineTo(monster.x + i * 20 + 10, monster.y - 15);
                        ctx.lineTo(monster.x + i * 20 + 20, monster.y);
                        ctx.fill();
                    }
                    ctx.fillStyle = '#ff0000';
                    ctx.beginPath();
                    ctx.arc(monster.x + 12, monster.y + 20, 6, 0, Math.PI * 2);
                    ctx.arc(monster.x + monster.width - 12, monster.y + 20, 6, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#000';
                    ctx.fillRect(monster.x + 10, monster.y + 30, monster.width - 20, 8);
                }
                
                ctx.globalAlpha = 1;
            });
            
            projectiles.forEach(proj => {
                if (proj.isEnemy) {
                    ctx.shadowColor = '#ff4400';
                    ctx.shadowBlur = 15;
                    ctx.fillStyle = '#ff6600';
                    ctx.beginPath();
                    ctx.arc(proj.x + proj.width/2, proj.y + proj.height/2, proj.height/2, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#ffcc00';
                    ctx.beginPath();
                    ctx.arc(proj.x + proj.width/2, proj.y + proj.height/2, proj.height/3, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    ctx.shadowColor = '#00d4ff';
                    ctx.shadowBlur = 10;
                    ctx.fillStyle = '#00d4ff';
                    ctx.fillRect(proj.x, proj.y, proj.width, proj.height);
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(proj.x + proj.width - 10, proj.y + 2, 8, proj.height - 4);
                }
                ctx.shadowBlur = 0;
            });
            
            // Draw player
            ctx.save();
            
            if (player.invincible && Math.floor(player.invincibleTimer / 4) % 2 === 0) {
                ctx.globalAlpha = 0.5;
            }
            
            ctx.shadowColor = '#000';
            ctx.shadowBlur = 20;
            ctx.fillStyle = '#000';
            ctx.fillRect(player.x, player.y, player.width, player.height);
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(player.x + 5, player.y + 5, player.width - 10, player.height - 10);
            ctx.shadowBlur = 0;
            
            ctx.fillStyle = '#00d4ff';
            ctx.shadowColor = '#00d4ff';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(player.x + 12, player.y + 15, 4, 0, Math.PI * 2);
            ctx.arc(player.x + player.width - 12, player.y + 15, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            
            if (player.grounded) {
                ctx.fillStyle = '#000';
                const legOffset = Math.sin(player.runFrame * Math.PI / 2) * 8;
                ctx.fillRect(player.x + 5, player.y + player.height - 5, 12, 15 + legOffset);
                ctx.fillRect(player.x + player.width - 17, player.y + player.height - 5, 12, 15 - legOffset);
            } else {
                ctx.fillStyle = '#000';
                ctx.fillRect(player.x + 5, player.y + player.height - 5, 12, 10);
                ctx.fillRect(player.x + player.width - 17, player.y + player.height - 5, 12, 10);
            }
            
            if (player.attacking) {
                ctx.strokeStyle = '#00d4ff';
                ctx.lineWidth = 3;
                ctx.shadowColor = '#00d4ff';
                ctx.shadowBlur = 15;
                ctx.beginPath();
                ctx.arc(player.x + player.width/2, player.y + player.height/2, 50, -Math.PI/3, Math.PI/3);
                ctx.stroke();
                ctx.shadowBlur = 0;
            }
            
            ctx.restore();
            
            particles.forEach(p => {
                ctx.globalAlpha = p.life / 50;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.globalAlpha = 1;
            
            if (dragonMode) {
                ctx.fillStyle = 'rgba(139, 0, 0, 0.1)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        }
        
        // Game loop
        function gameLoop() {
            update();
            draw();
            requestAnimationFrame(gameLoop);
        }
        
        // Start game
        function startGame() {
            document.getElementById('startScreen').style.display = 'none';
            gameRunning = true;
            initGame();
        }
        
        // Initialize game
        function initGame() {
            score = 0;
            lives = 3;
            gameTime = 0;
            dragonMode = false;
            warningShown = false;
            gameSpeed = baseSpeed;
            
            player.x = canvas.width * 0.1;
            player.y = groundY;
            player.velocityY = 0;
            player.jumping = false;
            player.doubleJump = false;
            player.grounded = true;
            player.invincible = false;
            
            platforms = [{x: 0, y: groundY + player.height, width: canvas.width * 2, height: 50}];
            coins = [];
            monsters = [];
            particles = [];
            projectiles = [];
            
            initBackground();
            
            document.getElementById('score').textContent = '0';
            document.getElementById('lives').textContent = '3';
            document.getElementById('time').textContent = '0:00';
            document.getElementById('warningMessage').style.opacity = '0';
        }
        
        // Game over
        function gameOver() {
            gameRunning = false;
            document.getElementById('finalScore').textContent = score;
            document.getElementById('gameOverScreen').style.display = 'flex';
        }
        
        // Restart
        function restartGame() {
            document.getElementById('gameOverScreen').style.display = 'none';
            gameRunning = true;
            initGame();
        }
        
        // Desktop Keyboard Input
        document.addEventListener('keydown', (e) => {
            keys[e.key] = true;
            if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            keys[e.key] = false;
        });
        
        // Mobile Touch Controls
        
        // Touch gestures on canvas
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            touchStartY = touch.clientY;
            touchStartTime = Date.now();
            
            // Tap on left side = jump, right side = attack
            const rect = canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            
            if (x < canvas.width / 2) {
                doJump();
            } else {
                doAttack();
            }
        }, {passive: false});
        
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
        }, {passive: false});
        
        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            const touch = e.changedTouches[0];
            const deltaY = touch.clientY - touchStartY;
            const deltaTime = Date.now() - touchStartTime;
            
            // Swipe down to fast fall
            if (deltaY > 50 && deltaTime < 300) {
                doFastFall();
            }
        }, {passive: false});
        
        // Mobile control buttons
        const btnJump = document.getElementById('btnJump');
        const btnFall = document.getElementById('btnFall');
        const btnAttack = document.getElementById('btnAttack');
        
        // Jump button
        btnJump.addEventListener('touchstart', (e) => {
            e.preventDefault();
            doJump();
            btnJump.style.background = 'rgba(0, 212, 255, 0.3)';
            btnJump.style.borderColor = '#00d4ff';
        }, {passive: false});
        
        btnJump.addEventListener('touchend', (e) => {
            e.preventDefault();
            btnJump.style.background = 'rgba(255, 255, 255, 0.15)';
            btnJump.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        }, {passive: false});
        
        // Fall button
        btnFall.addEventListener('touchstart', (e) => {
            e.preventDefault();
            doFastFall();
            btnFall.style.background = 'rgba(0, 212, 255, 0.3)';
            btnFall.style.borderColor = '#00d4ff';
        }, {passive: false});
        
        btnFall.addEventListener('touchend', (e) => {
            e.preventDefault();
            btnFall.style.background = 'rgba(255, 255, 255, 0.15)';
            btnFall.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        }, {passive: false});
        
        // Attack button
        btnAttack.addEventListener('touchstart', (e) => {
            e.preventDefault();
            doAttack();
            btnAttack.style.background = 'rgba(0, 212, 255, 0.3)';
            btnAttack.style.borderColor = '#00d4ff';
        }, {passive: false});
        
        btnAttack.addEventListener('touchend', (e) => {
            e.preventDefault();
            btnAttack.style.background = 'rgba(255, 255, 255, 0.15)';
            btnAttack.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        }, {passive: false});
        
        // Also support mouse clicks for buttons (for testing on desktop)
        btnJump.addEventListener('mousedown', (e) => {
            e.preventDefault();
            doJump();
        });
        
        btnFall.addEventListener('mousedown', (e) => {
            e.preventDefault();
            doFastFall();
        });
        
        btnAttack.addEventListener('mousedown', (e) => {
            e.preventDefault();
            doAttack();
        });
        
        // Button event listeners
        document.getElementById('startBtn').addEventListener('click', startGame);
        document.getElementById('restartBtn').addEventListener('click', restartGame);
        
        // Detect mobile
        window.addEventListener('resize', () => {
            isMobile = window.innerWidth <= 768;
            resizeCanvas();
        });
        
        // Prevent scrolling on mobile
        document.body.addEventListener('touchmove', (e) => {
            e.preventDefault();
        }, {passive: false});
        
        // Start loop
        initBackground();
        gameLoop();
