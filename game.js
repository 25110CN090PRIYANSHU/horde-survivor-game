// NEON HORDE: SURVIVORS - Core Game Engine
// Developed with HTML5 Canvas, Web Audio API & Pure Modern JS

(function() {
    'use strict';

    // --- Utility Math & Helpers ---
    const clamp = (val, min, max) => Math.min(Math.max(val, min), max);
    const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
    const randRange = (min, max) => Math.random() * (max - min) + min;

    // --- Spatial Partitioning Grid for High-Performance Swarms ---
    class SpatialGrid {
        constructor(width, height, cellSize = 100) {
            this.cellSize = cellSize;
            this.cols = Math.ceil(width / cellSize);
            this.rows = Math.ceil(height / cellSize);
            this.grid = new Map();
        }

        clear() {
            this.grid.clear();
        }

        getKey(col, row) {
            return `${col}_${row}`;
        }

        insert(entity) {
            const col = Math.floor(entity.x / this.cellSize);
            const row = Math.floor(entity.y / this.cellSize);
            const key = this.getKey(col, row);
            if (!this.grid.has(key)) {
                this.grid.set(key, []);
            }
            this.grid.get(key).push(entity);
        }

        getNearby(x, y, radius) {
            const minCol = Math.floor((x - radius) / this.cellSize);
            const maxCol = Math.floor((x + radius) / this.cellSize);
            const minRow = Math.floor((y - radius) / this.cellSize);
            const maxRow = Math.floor((y + radius) / this.cellSize);

            const result = [];
            for (let c = minCol; c <= maxCol; c++) {
                for (let r = minRow; r <= maxRow; r++) {
                    const key = this.getKey(c, r);
                    const cell = this.grid.get(key);
                    if (cell) {
                        for (let i = 0; i < cell.length; i++) {
                            result.push(cell[i]);
                        }
                    }
                }
            }
            return result;
        }
    }

    // --- Particle System ---
    class Particle {
        constructor(x, y, vx, vy, color, size, life, shape = 'circle') {
            this.x = x;
            this.y = y;
            this.vx = vx;
            this.vy = vy;
            this.color = color;
            this.size = size;
            this.maxLife = life;
            this.life = life;
            this.shape = shape;
        }

        update(dt) {
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            this.vx *= 0.94;
            this.vy *= 0.94;
            this.life -= dt;
            return this.life > 0;
        }

        draw(ctx) {
            const alpha = Math.max(0, this.life / this.maxLife);
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            if (this.shape === 'spark') {
                ctx.rect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
            } else {
                ctx.arc(this.x, this.y, Math.max(0.5, this.size * alpha), 0, Math.PI * 2);
            }
            ctx.fill();
            ctx.restore();
        }
    }

    // --- Floating Damage & Combat Text ---
    class FloatingText {
        constructor(x, y, text, color, isCrit = false) {
            this.x = x + randRange(-12, 12);
            this.y = y - 10;
            this.text = text;
            this.color = color;
            this.isCrit = isCrit;
            this.life = 0.75;
            this.maxLife = 0.75;
            this.vy = isCrit ? -70 : -45;
        }

        update(dt) {
            this.y += this.vy * dt;
            this.life -= dt;
            return this.life > 0;
        }

        draw(ctx) {
            const alpha = Math.max(0, this.life / this.maxLife);
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.font = this.isCrit ? "bold 16px 'Orbitron', monospace" : "13px 'Rajdhani', sans-serif";
            ctx.fillStyle = this.color;
            ctx.shadowColor = this.color;
            ctx.shadowBlur = this.isCrit ? 8 : 4;
            ctx.textAlign = 'center';
            ctx.fillText(this.text, this.x, this.y);
            ctx.restore();
        }
    }

    // --- XP Gem Drop ---
    class XpGem {
        constructor(x, y, value) {
            this.x = x;
            this.y = y;
            this.value = value;
            this.radius = value >= 20 ? 8 : (value >= 5 ? 6 : 4);
            this.color = value >= 20 ? '#ff00ff' : (value >= 5 ? '#05ffa1' : '#00f3ff');
            this.vx = 0;
            this.vy = 0;
            this.pulse = Math.random() * Math.PI * 2;
            this.attracted = false;
        }

        update(player, dt) {
            this.pulse += dt * 4;
            const d = dist(this.x, this.y, player.x, player.y);

            if (d < player.pickupRadius) {
                this.attracted = true;
            }

            if (this.attracted) {
                const angleToPlayer = Math.atan2(player.y - this.y, player.x - this.x);
                const speed = 480 + (player.pickupRadius - d) * 1.5;
                this.x += Math.cos(angleToPlayer) * speed * dt;
                this.y += Math.sin(angleToPlayer) * speed * dt;

                if (d < player.radius + this.radius) {
                    player.addXp(this.value);
                    window.soundManager.playGemPickup();
                    return false; // Collected
                }
            }
            return true;
        }

        draw(ctx) {
            ctx.save();
            ctx.fillStyle = this.color;
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 8;
            const r = this.radius + Math.sin(this.pulse) * 1.2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    // --- Damage Zone (Flame Puddle from Bombs) ---
    class DamageZone {
        constructor(x, y, radius, dps, duration, color = '#ff5500') {
            this.x = x;
            this.y = y;
            this.radius = radius;
            this.dps = dps;
            this.duration = duration;
            this.color = color;
            this.tickTimer = 0;
        }

        update(dt, enemies, game) {
            this.duration -= dt;
            this.tickTimer += dt;

            // Damage tick every 0.25s
            if (this.tickTimer >= 0.25) {
                this.tickTimer = 0;
                const damage = Math.round(this.dps * 0.25);
                enemies.forEach(e => {
                    if (dist(this.x, this.y, e.x, e.y) < this.radius + e.radius) {
                        e.takeDamage(damage, false, game);
                    }
                });
            }
            return this.duration > 0;
        }

        draw(ctx) {
            ctx.save();
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = 0.7;
            ctx.strokeStyle = '#ffaa00';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        }
    }

    // --- Enemy Classes ---
    class Enemy {
        constructor(x, y, type, timeElapsed) {
            this.x = x;
            this.y = y;
            this.type = type;
            this.vx = 0;
            this.vy = 0;
            this.knockbackX = 0;
            this.knockbackY = 0;

            // Difficulty multiplier scaling gently with run time
            const diffFactor = 1 + timeElapsed * 0.0035;

            switch (type) {
                case 'stalker': // Fast cyber bat
                    this.radius = 12;
                    this.speed = 175;
                    this.maxHp = Math.round(18 * diffFactor);
                    this.color = '#ff00aa';
                    this.xpValue = 1;
                    this.damage = 8;
                    this.mass = 0.8;
                    break;
                case 'brute': // Heavy tank
                    this.radius = 24;
                    this.speed = 70;
                    this.maxHp = Math.round(110 * diffFactor);
                    this.color = '#9d4edd';
                    this.xpValue = 5;
                    this.damage = 18;
                    this.mass = 2.5;
                    break;
                case 'shooter': // Ranged droid
                    this.radius = 15;
                    this.speed = 95;
                    this.maxHp = Math.round(35 * diffFactor);
                    this.color = '#ff9f1c';
                    this.xpValue = 2;
                    this.damage = 10;
                    this.mass = 1.0;
                    this.shootCooldown = randRange(1.8, 2.5);
                    this.shootTimer = 0;
                    break;
                case 'boss': // Apex Boss
                    this.radius = 42;
                    this.speed = 85;
                    this.maxHp = Math.round(1200 * diffFactor);
                    this.color = '#ff0033';
                    this.xpValue = 50;
                    this.damage = 28;
                    this.mass = 6.0;
                    this.isBoss = true;
                    this.shootTimer = 0;
                    break;
                case 'crawler': // Standard swarm
                default:
                    this.radius = 14;
                    this.speed = 110;
                    this.maxHp = Math.round(25 * diffFactor);
                    this.color = '#05ffa1';
                    this.xpValue = 1;
                    this.damage = 10;
                    this.mass = 1.0;
                    break;
            }

            this.hp = this.maxHp;
            this.hitFlash = 0;
        }

        update(player, dt, game) {
            // Knockback recovery
            this.knockbackX *= 0.88;
            this.knockbackY *= 0.88;

            const angleToPlayer = Math.atan2(player.y - this.y, player.x - this.x);
            const d = dist(this.x, this.y, player.x, player.y);

            // Movement logic
            if (this.type === 'shooter' && d < 240) {
                // Keep distance
                this.x -= Math.cos(angleToPlayer) * this.speed * 0.5 * dt;
                this.y -= Math.sin(angleToPlayer) * this.speed * 0.5 * dt;

                this.shootTimer += dt;
                if (this.shootTimer >= this.shootCooldown) {
                    this.shootTimer = 0;
                    game.spawnEnemyBullet(this.x, this.y, angleToPlayer, 180, this.damage);
                }
            } else if (this.isBoss) {
                this.x += Math.cos(angleToPlayer) * this.speed * dt;
                this.y += Math.sin(angleToPlayer) * this.speed * dt;

                // Boss ring attack
                this.shootTimer += dt;
                if (this.shootTimer >= 3.2) {
                    this.shootTimer = 0;
                    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
                        game.spawnEnemyBullet(this.x, this.y, a, 140, 15);
                    }
                }
            } else {
                this.x += Math.cos(angleToPlayer) * this.speed * dt;
                this.y += Math.sin(angleToPlayer) * this.speed * dt;
            }

            this.x += this.knockbackX * dt;
            this.y += this.knockbackY * dt;

            if (this.hitFlash > 0) this.hitFlash -= dt;

            // Player contact damage
            if (d < this.radius + player.radius) {
                player.takeDamage(this.damage, game);
            }
        }

        takeDamage(amount, isCrit, game) {
            this.hp -= amount;
            this.hitFlash = 0.12;
            game.floatingTexts.push(new FloatingText(this.x, this.y, isCrit ? `CRIT! ${amount}` : `${amount}`, isCrit ? '#ffbe0b' : '#ffffff', isCrit));
            game.totalDamageDealt += amount;
            window.soundManager.playHit();

            // Blood/spark particles
            game.spawnSparks(this.x, this.y, this.color, 4);

            if (this.hp <= 0) {
                this.die(game);
                return true;
            }
            return false;
        }

        applyKnockback(kx, ky) {
            this.knockbackX += kx / this.mass;
            this.knockbackY += ky / this.mass;
        }

        die(game) {
            game.kills++;
            game.score += this.xpValue * 50;

            // Spawn XP gems
            if (this.isBoss) {
                game.xpGems.push(new XpGem(this.x, this.y, 25));
                game.xpGems.push(new XpGem(this.x + 15, this.y, 25));
                game.spawnExplosion(this.x, this.y, 60);
                window.soundManager.playExplosion();
            } else if (this.xpValue >= 5) {
                game.xpGems.push(new XpGem(this.x, this.y, 5));
            } else {
                game.xpGems.push(new XpGem(this.x, this.y, 1));
            }

            // Death particles
            game.spawnSparks(this.x, this.y, this.color, this.isBoss ? 35 : 12);
        }

        draw(ctx) {
            ctx.save();
            ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : this.color;
            ctx.shadowColor = this.color;
            ctx.shadowBlur = this.isBoss ? 20 : 8;

            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();

            // Inner styling / eye
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius * 0.45, 0, Math.PI * 2);
            ctx.fill();

            // Boss health bar
            if (this.isBoss) {
                const barWidth = 60;
                const hpPercent = Math.max(0, this.hp / this.maxHp);
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.fillRect(this.x - barWidth / 2, this.y - this.radius - 14, barWidth, 6);
                ctx.fillStyle = '#ff0033';
                ctx.fillRect(this.x - barWidth / 2, this.y - this.radius - 14, barWidth * hpPercent, 6);
            }

            ctx.restore();
        }
    }

    // --- Enemy Projectile ---
    class EnemyBullet {
        constructor(x, y, angle, speed, damage) {
            this.x = x;
            this.y = y;
            this.vx = Math.cos(angle) * speed;
            this.vy = Math.sin(angle) * speed;
            this.damage = damage;
            this.radius = 5;
            this.life = 4.0;
        }

        update(dt, player, game) {
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            this.life -= dt;

            if (dist(this.x, this.y, player.x, player.y) < this.radius + player.radius) {
                player.takeDamage(this.damage, game);
                return false;
            }
            return this.life > 0;
        }

        draw(ctx) {
            ctx.save();
            ctx.fillStyle = '#ff3366';
            ctx.shadowColor = '#ff3366';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    // --- Player Projectiles & Weapons ---
    class PlayerProjectile {
        constructor(x, y, vx, vy, damage, pierce = 1, type = 'bolt', maxRange = 700) {
            this.x = x;
            this.y = y;
            this.vx = vx;
            this.vy = vy;
            this.damage = damage;
            this.pierce = pierce;
            this.type = type;
            this.startX = x;
            this.startY = y;
            this.maxRange = maxRange;
            this.radius = type === 'bomb' ? 8 : (type === 'boomerang' ? 10 : 5);
            this.color = type === 'bomb' ? '#ff9f1c' : (type === 'boomerang' ? '#9d4edd' : '#00f3ff');
            this.angle = 0;
            this.returning = false;
        }

        update(dt, player, enemies, game) {
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            this.angle += dt * 15;

            // Boomerang behavior: decelerates, reverses and returns to player
            if (this.type === 'boomerang') {
                const travelled = dist(this.startX, this.startY, this.x, this.y);
                if (travelled > this.maxRange && !this.returning) {
                    this.returning = true;
                }
                if (this.returning) {
                    const toPlayer = Math.atan2(player.y - this.y, player.x - this.x);
                    const speed = 400;
                    this.vx = Math.cos(toPlayer) * speed;
                    this.vy = Math.sin(toPlayer) * speed;
                    if (dist(this.x, this.y, player.x, player.y) < 25) {
                        return false; // caught
                    }
                }
            } else if (dist(this.startX, this.startY, this.x, this.y) > this.maxRange) {
                if (this.type === 'bomb') {
                    game.detonateBomb(this.x, this.y, this.damage);
                }
                return false;
            }

            // Hit collision
            for (let i = 0; i < enemies.length; i++) {
                const e = enemies[i];
                if (dist(this.x, this.y, e.x, e.y) < this.radius + e.radius) {
                    if (this.type === 'bomb') {
                        game.detonateBomb(this.x, this.y, this.damage);
                        return false;
                    }

                    const isCrit = Math.random() < player.critChance;
                    const finalDmg = isCrit ? this.damage * 2 : this.damage;
                    e.takeDamage(finalDmg, isCrit, game);
                    e.applyKnockback(this.vx * 0.4, this.vy * 0.4);

                    this.pierce--;
                    if (this.pierce <= 0) return false;
                }
            }

            return true;
        }

        draw(ctx) {
            ctx.save();
            ctx.fillStyle = this.color;
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            if (this.type === 'boomerang') {
                ctx.translate(this.x, this.y);
                ctx.rotate(this.angle);
                ctx.fillRect(-this.radius, -2, this.radius * 2, 4);
                ctx.fillRect(-2, -this.radius, 4, this.radius * 2);
            } else {
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }

    // --- Main Player Class ---
    class Player {
        constructor(characterClass) {
            this.x = 1500;
            this.y = 1500;
            this.radius = 16;
            this.charClass = characterClass;

            // Base attributes
            this.maxHp = 100;
            this.hp = 100;
            this.speed = 220;
            this.regenRate = 0; // HP/sec
            this.pickupRadius = 90;
            this.critChance = 0.08;

            // Modifiers
            this.damageMultiplier = 1.0;
            this.cooldownMultiplier = 1.0;
            this.projSpeedMultiplier = 1.0;
            this.areaMultiplier = 1.0;

            // Dash Mechanics
            this.dashCooldown = 2.4;
            this.dashTimer = 0;
            this.isDashing = false;
            this.dashDuration = 0.18;
            this.dashActiveTimer = 0;
            this.dashVx = 0;
            this.dashVy = 0;

            // Invulnerability frames
            this.invulnTimer = 0;

            // Level & XP
            this.level = 1;
            this.xp = 0;
            this.xpNeeded = 10;

            // Weapons Inventory: { id, level }
            this.weapons = {};
            // Passives Inventory: { id, level }
            this.passives = {};

            // Weapon timers
            this.wandTimer = 0;
            this.lightningTimer = 0;
            this.bombTimer = 0;
            this.boomerangTimer = 0;
            this.orbitAngle = 0;

            // Initialize class archetypes
            if (characterClass === 'cyber-mage') {
                this.weapons['wand'] = 1;
                this.projSpeedMultiplier = 1.25;
                this.cooldownMultiplier = 0.9;
            } else if (characterClass === 'blade-dancer') {
                this.weapons['glaive'] = 1;
                this.speed = 255;
                this.dashCooldown = 1.7;
            } else if (characterClass === 'pyro-grenadier') {
                this.weapons['bomb'] = 1;
                this.maxHp = 135;
                this.hp = 135;
                this.areaMultiplier = 1.3;
            } else {
                this.weapons['wand'] = 1;
            }
        }

        update(dt, input, game) {
            // Regeneration
            if (this.regenRate > 0 && this.hp < this.maxHp) {
                this.hp = Math.min(this.maxHp, this.hp + this.regenRate * dt);
            }

            // Dash cooldown
            if (this.dashTimer > 0) this.dashTimer -= dt;
            if (this.invulnTimer > 0) this.invulnTimer -= dt;

            // Active Dash
            if (this.isDashing) {
                this.x += this.dashVx * dt;
                this.y += this.dashVy * dt;
                this.dashActiveTimer -= dt;
                game.spawnSparks(this.x, this.y, '#00f3ff', 3);
                if (this.dashActiveTimer <= 0) {
                    this.isDashing = false;
                }
            } else {
                // Movement
                let mx = 0;
                let my = 0;
                if (input.up) my -= 1;
                if (input.down) my += 1;
                if (input.left) mx -= 1;
                if (input.right) mx += 1;

                if (mx !== 0 || my !== 0) {
                    const len = Math.hypot(mx, my);
                    const moveSpeed = this.speed;
                    this.x += (mx / len) * moveSpeed * dt;
                    this.y += (my / len) * moveSpeed * dt;

                    // Dash trigger
                    if (input.dash && this.dashTimer <= 0) {
                        this.triggerDash(mx / len, my / len);
                    }
                }
            }

            // Arena boundaries (3000 x 3000)
            this.x = clamp(this.x, 30, 2970);
            this.y = clamp(this.y, 30, 2970);

            // Orbit Glaives rotation
            this.orbitAngle += dt * (2.8 + (this.weapons['glaive'] ? this.weapons['glaive'] * 0.4 : 0));

            // Auto-fire weapons
            this.updateWeapons(dt, game);
        }

        triggerDash(dirX, dirY) {
            this.isDashing = true;
            this.dashActiveTimer = this.dashDuration;
            this.dashTimer = this.dashCooldown;
            this.invulnTimer = this.dashDuration + 0.1;
            const dashSpeed = this.speed * 3.2;
            this.dashVx = dirX * dashSpeed;
            this.dashVy = dirY * dashSpeed;
            window.soundManager.playDash();
        }

        updateWeapons(dt, game) {
            // 1. Plasma Wand
            if (this.weapons['wand']) {
                const lvl = this.weapons['wand'];
                const baseCooldown = Math.max(0.25, 0.75 - lvl * 0.08) * this.cooldownMultiplier;
                this.wandTimer += dt;
                if (this.wandTimer >= baseCooldown) {
                    this.wandTimer = 0;
                    this.fireWand(lvl, game);
                }
            }

            // 2. Orbital Glaive damage is calculated during render/collision loop below

            // 3. Lightning Storm
            if (this.weapons['lightning']) {
                const lvl = this.weapons['lightning'];
                const baseCooldown = (lvl >= 5 ? 1.6 : 2.5) * this.cooldownMultiplier;
                this.lightningTimer += dt;
                if (this.lightningTimer >= baseCooldown) {
                    this.lightningTimer = 0;
                    this.fireLightning(lvl, game);
                }
            }

            // 4. Plasma Bomb
            if (this.weapons['bomb']) {
                const lvl = this.weapons['bomb'];
                const baseCooldown = 2.0 * this.cooldownMultiplier;
                this.bombTimer += dt;
                if (this.bombTimer >= baseCooldown) {
                    this.bombTimer = 0;
                    this.fireBomb(lvl, game);
                }
            }

            // 5. Piercing Boomerang
            if (this.weapons['boomerang']) {
                const lvl = this.weapons['boomerang'];
                const baseCooldown = 2.2 * this.cooldownMultiplier;
                this.boomerangTimer += dt;
                if (this.boomerangTimer >= baseCooldown) {
                    this.boomerangTimer = 0;
                    this.fireBoomerang(lvl, game);
                }
            }
        }

        fireWand(lvl, game) {
            const nearby = game.getNearestEnemies(this.x, this.y, 650, 1);
            if (nearby.length === 0) return;

            const target = nearby[0];
            const baseAngle = Math.atan2(target.y - this.y, target.x - this.x);
            const shots = lvl >= 4 ? 3 : (lvl >= 2 ? 2 : 1);
            const spread = 0.18;
            const pierce = lvl >= 5 ? 2 : 1;
            const dmg = Math.round((22 + lvl * 6) * this.damageMultiplier);
            const speed = 550 * this.projSpeedMultiplier;

            for (let i = 0; i < shots; i++) {
                const offset = (i - (shots - 1) / 2) * spread;
                const a = baseAngle + offset;
                game.playerProjectiles.push(new PlayerProjectile(
                    this.x, this.y,
                    Math.cos(a) * speed, Math.sin(a) * speed,
                    dmg, pierce, 'bolt'
                ));
            }
            window.soundManager.playShoot('bolt');
        }

        fireLightning(lvl, game) {
            const count = lvl >= 4 ? 3 : (lvl >= 2 ? 2 : 1);
            const targets = game.getNearestEnemies(this.x, this.y, 500, count);
            if (targets.length === 0) return;

            const baseDmg = Math.round((45 + lvl * 18) * this.damageMultiplier);

            targets.forEach(t => {
                const isCrit = Math.random() < this.critChance;
                const dmg = isCrit ? baseDmg * 2 : baseDmg;
                t.takeDamage(dmg, isCrit, game);
                game.spawnLightningBolt(this.x, this.y, t.x, t.y);
                game.spawnSparks(t.x, t.y, '#ffff00', 8);
            });
            window.soundManager.playShoot('lightning');
        }

        fireBomb(lvl, game) {
            const count = lvl >= 4 ? 2 : 1;
            const targets = game.getNearestEnemies(this.x, this.y, 600, count);
            const target = targets.length > 0 ? targets[0] : null;

            const angle = target ? Math.atan2(target.y - this.y, target.x - this.x) : Math.random() * Math.PI * 2;
            const dmg = Math.round((50 + lvl * 20) * this.damageMultiplier);
            const speed = 320 * this.projSpeedMultiplier;

            for (let i = 0; i < count; i++) {
                const a = angle + (i * 0.5 - 0.25);
                game.playerProjectiles.push(new PlayerProjectile(
                    this.x, this.y,
                    Math.cos(a) * speed, Math.sin(a) * speed,
                    dmg, 1, 'bomb', 380
                ));
            }
            window.soundManager.playShoot('fire');
        }

        fireBoomerang(lvl, game) {
            const count = lvl >= 3 ? 2 : 1;
            const nearby = game.getNearestEnemies(this.x, this.y, 500, 1);
            const baseAngle = nearby.length > 0 ? Math.atan2(nearby[0].y - this.y, nearby[0].x - this.x) : Math.random() * Math.PI * 2;
            const dmg = Math.round((30 + lvl * 12) * this.damageMultiplier);
            const speed = (lvl >= 4 ? 450 : 340) * this.projSpeedMultiplier;

            for (let i = 0; i < count; i++) {
                const a = baseAngle + (i === 1 ? Math.PI : 0);
                game.playerProjectiles.push(new PlayerProjectile(
                    this.x, this.y,
                    Math.cos(a) * speed, Math.sin(a) * speed,
                    dmg, 999, 'boomerang', 420
                ));
            }
            window.soundManager.playShoot('bolt');
        }

        checkGlaiveCollisions(game) {
            if (!this.weapons['glaive']) return;
            const lvl = this.weapons['glaive'];
            const bladeCount = lvl >= 4 ? 3 : (lvl >= 2 ? 2 : 1);
            const orbitRadius = (lvl >= 5 ? 100 : 78) * this.areaMultiplier;
            const dmg = Math.round((14 + lvl * 6) * this.damageMultiplier);

            for (let i = 0; i < bladeCount; i++) {
                const currentAngle = this.orbitAngle + (i * (Math.PI * 2 / bladeCount));
                const bx = this.x + Math.cos(currentAngle) * orbitRadius;
                const by = this.y + Math.sin(currentAngle) * orbitRadius;
                const bRadius = lvl >= 5 ? 14 : 10;

                const nearby = game.grid.getNearby(bx, by, bRadius + 25);
                nearby.forEach(e => {
                    if (dist(bx, by, e.x, e.y) < bRadius + e.radius) {
                        const isCrit = Math.random() < this.critChance;
                        e.takeDamage(isCrit ? dmg * 2 : dmg, isCrit, game);
                        e.applyKnockback(Math.cos(currentAngle) * 120, Math.sin(currentAngle) * 120);
                    }
                });
            }
        }

        addXp(amount) {
            this.xp += amount;
            while (this.xp >= this.xpNeeded) {
                this.xp -= this.xpNeeded;
                this.level++;
                this.xpNeeded = Math.floor(10 * Math.pow(1.22, this.level - 1));
                window.soundManager.playLevelUp();
                window.gameInstance.triggerLevelUp();
            }
        }

        takeDamage(amount, game) {
            if (this.invulnTimer > 0) return;
            this.hp -= amount;
            this.invulnTimer = 0.45; // I-frames
            game.screenShake = 12;
            window.soundManager.playPlayerHurt();

            if (this.hp <= 0) {
                this.hp = 0;
                game.triggerGameOver();
            }
        }

        draw(ctx) {
            ctx.save();

            // Dash glow effect
            if (this.isDashing) {
                ctx.fillStyle = 'rgba(0, 243, 255, 0.4)';
                ctx.beginPath();
                ctx.arc(this.x - this.dashVx * 0.04, this.y - this.dashVy * 0.04, this.radius * 1.3, 0, Math.PI * 2);
                ctx.fill();
            }

            // Invulnerability flash
            if (this.invulnTimer > 0 && Math.floor(Date.now() / 60) % 2 === 0) {
                ctx.globalAlpha = 0.45;
            }

            // Player Core
            ctx.fillStyle = '#00f3ff';
            ctx.shadowColor = '#00f3ff';
            ctx.shadowBlur = 18;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();

            // Inner Ring
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius * 0.5, 0, Math.PI * 2);
            ctx.fill();

            // Draw Orbiting Glaives
            if (this.weapons['glaive']) {
                const lvl = this.weapons['glaive'];
                const bladeCount = lvl >= 4 ? 3 : (lvl >= 2 ? 2 : 1);
                const orbitRadius = (lvl >= 5 ? 100 : 78) * this.areaMultiplier;
                const bRadius = lvl >= 5 ? 14 : 10;

                ctx.shadowColor = '#ff007f';
                ctx.shadowBlur = 12;
                ctx.fillStyle = '#ff007f';

                for (let i = 0; i < bladeCount; i++) {
                    const currentAngle = this.orbitAngle + (i * (Math.PI * 2 / bladeCount));
                    const bx = this.x + Math.cos(currentAngle) * orbitRadius;
                    const by = this.y + Math.sin(currentAngle) * orbitRadius;

                    ctx.beginPath();
                    ctx.arc(bx, by, bRadius, 0, Math.PI * 2);
                    ctx.fill();

                    // Glaive trail
                    ctx.strokeStyle = 'rgba(255, 0, 127, 0.3)';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, orbitRadius, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }

            ctx.restore();
        }
    }

    // --- Upgrade Catalog & Synergies ---
    const UPGRADES_DB = [
        {
            id: 'wand',
            name: 'Plasma Wand',
            type: 'weapon',
            icon: '⚡',
            maxLevel: 5,
            desc: [
                'Rapidly shoots plasma bolts at nearest targets.',
                '+1 Extra Projectile bolt.',
                '+25% Bolt Damage and Flight Speed.',
                '+1 Additional Projectile (3 total).',
                'Plasma bolts pierce through enemies.'
            ]
        },
        {
            id: 'glaive',
            name: 'Orbital Glaive',
            type: 'weapon',
            icon: '⚔️',
            maxLevel: 5,
            desc: [
                'Energy blade that circles the operative continuously.',
                'Adds a second rotating glaive.',
                '+35% Rotation speed & damage.',
                'Adds a third rotating glaive.',
                'Expands orbit radius and blade dimensions.'
            ]
        },
        {
            id: 'lightning',
            name: 'Lightning Storm',
            type: 'weapon',
            icon: '🌩️',
            maxLevel: 5,
            desc: [
                'Strikes random nearby hostiles with lightning.',
                'Strikes 2 targets at once.',
                '+40% Damage and electric shockwaves.',
                'Strikes 3 targets simultaneously.',
                '-40% Cooldown interval.'
            ]
        },
        {
            id: 'bomb',
            name: 'Plasma Bomb',
            type: 'weapon',
            icon: '💣',
            maxLevel: 5,
            desc: [
                'Lobs explosive charges that detonate on contact.',
                '+30% Blast explosion radius.',
                'Leaves lingering plasma fire zones on ground.',
                'Lobs 2 bombs simultaneously.',
                '+50% Blast damage.'
            ]
        },
        {
            id: 'boomerang',
            name: 'Piercing Scythe',
            type: 'weapon',
            icon: '🪃',
            maxLevel: 5,
            desc: [
                'Throws a returning energy scythe that pierces swarms.',
                '+30% Damage bonus.',
                'Throws 2 scythes in opposing directions.',
                '+40% Flight velocity.',
                'Scythe detonates in a kinetic pulse at maximum range.'
            ]
        },
        {
            id: 'overclock',
            name: 'Overclock Chip',
            type: 'passive',
            icon: '⏱️',
            maxLevel: 5,
            desc: [
                '-12% Weapon cooldown intervals.',
                '-22% Weapon cooldown intervals.',
                '-30% Weapon cooldown intervals.',
                '-38% Weapon cooldown intervals.',
                '-45% Weapon cooldown intervals.'
            ]
        },
        {
            id: 'titan_plating',
            name: 'Titan Plating',
            type: 'passive',
            icon: '🛡️',
            maxLevel: 5,
            desc: [
                '+25 Max HP and restores 25 HP.',
                '+50 Max HP and restores 50 HP.',
                '+75 Max HP and restores 75 HP.',
                '+100 Max HP and restores 100 HP.',
                '+130 Max HP and restores 130 HP.'
            ]
        },
        {
            id: 'vortex_magnet',
            name: 'Vortex Magnet',
            type: 'passive',
            icon: '🧲',
            maxLevel: 5,
            desc: [
                '+50% Energy gem collection range.',
                '+100% Energy gem collection range.',
                '+150% Energy gem collection range.',
                '+200% Energy gem collection range.',
                'Collects all visible gems on screen periodically.'
            ]
        },
        {
            id: 'hyper_thrusters',
            name: 'Hyper Thrusters',
            type: 'passive',
            icon: '👟',
            maxLevel: 5,
            desc: [
                '+15% Operative movement speed.',
                '+30% Operative movement speed.',
                '+45% Operative movement speed.',
                '+60% Operative movement speed.',
                '+80% Operative movement speed and dash cooldown -25%.'
            ]
        },
        {
            id: 'nanite_repair',
            name: 'Nanite Repair',
            type: 'passive',
            icon: '💉',
            maxLevel: 5,
            desc: [
                '+1.0 HP per second health regeneration.',
                '+2.0 HP per second health regeneration.',
                '+3.2 HP per second health regeneration.',
                '+4.5 HP per second health regeneration.',
                '+6.0 HP per second health regeneration.'
            ]
        },
        {
            id: 'crit_targeting',
            name: 'Crit Targeting',
            type: 'passive',
            icon: '🎯',
            maxLevel: 5,
            desc: [
                '+10% Critical strike chance (2x damage).',
                '+20% Critical strike chance.',
                '+30% Critical strike chance.',
                '+40% Critical strike chance.',
                '+50% Critical strike chance.'
            ]
        }
    ];

    // --- Main Game Orchestrator ---
    class Game {
        constructor() {
            this.canvas = document.getElementById('gameCanvas');
            this.ctx = this.canvas.getContext('2d');

            this.arenaWidth = 3000;
            this.arenaHeight = 3000;
            this.grid = new SpatialGrid(this.arenaWidth, this.arenaHeight, 120);

            // States: 'START', 'PLAYING', 'LEVEL_UP', 'PAUSED', 'GAME_OVER'
            this.state = 'START';
            this.selectedClass = 'cyber-mage';

            // High scores
            this.loadRecords();

            // Entities
            this.player = null;
            this.enemies = [];
            this.enemyBullets = [];
            this.playerProjectiles = [];
            this.damageZones = [];
            this.xpGems = [];
            this.particles = [];
            this.floatingTexts = [];
            this.lightningEffects = [];

            // Run stats
            this.timeElapsed = 0;
            this.kills = 0;
            this.score = 0;
            this.totalDamageDealt = 0;
            this.rerollsRemaining = 1;

            // Spawn cadence
            this.spawnTimer = 0;
            this.bossTimer = 0;
            this.nextBossMilestone = 90; // 1:30

            // Camera & FX
            this.cameraX = 0;
            this.cameraY = 0;
            this.screenShake = 0;

            // Input state
            this.input = {
                up: false,
                down: false,
                left: false,
                right: false,
                dash: false
            };

            this.lastFrameTime = performance.now();

            this.initWindow();
            this.initInputs();
            this.initUI();

            requestAnimationFrame(this.loop.bind(this));
        }

        initWindow() {
            const resize = () => {
                const width = Math.max(320, document.documentElement.clientWidth || window.innerWidth);
                const height = Math.max(320, window.visualViewport?.height || window.innerHeight);
                this.canvas.width = width;
                this.canvas.height = height;
                this.canvas.style.width = `${width}px`;
                this.canvas.style.height = `${height}px`;
            };
            window.addEventListener('resize', resize);
            window.visualViewport?.addEventListener('resize', resize);
            window.addEventListener('orientationchange', () => setTimeout(resize, 120));
            resize();
        }

        initInputs() {
            window.addEventListener('keydown', (e) => {
                const key = e.key.toLowerCase();

                if (key === 'w' || key === 'arrowup') this.input.up = true;
                if (key === 's' || key === 'arrowdown') this.input.down = true;
                if (key === 'a' || key === 'arrowleft') this.input.left = true;
                if (key === 'd' || key === 'arrowright') this.input.right = true;
                if (key === ' ' || key === 'shift') this.input.dash = true;

                if (key === 'escape' || key === 'p') {
                    if (this.state === 'PLAYING') this.pauseGame();
                    else if (this.state === 'PAUSED') this.resumeGame();
                }

                // Audio activation on interaction
                window.soundManager.init();
            });

            window.addEventListener('keyup', (e) => {
                const key = e.key.toLowerCase();
                if (key === 'w' || key === 'arrowup') this.input.up = false;
                if (key === 's' || key === 'arrowdown') this.input.down = false;
                if (key === 'a' || key === 'arrowleft') this.input.left = false;
                if (key === 'd' || key === 'arrowright') this.input.right = false;
                if (key === ' ' || key === 'shift') this.input.dash = false;
            });

            // Touch / Mouse virtual direction controls
            let isPointerDown = false;
            this.canvas.addEventListener('pointerdown', (e) => {
                isPointerDown = true;
                window.soundManager.init();
                this.handlePointer(e);
            });
            window.addEventListener('pointermove', (e) => {
                if (isPointerDown) this.handlePointer(e);
            });
            window.addEventListener('pointerup', () => {
                isPointerDown = false;
                if (this.state === 'PLAYING') {
                    this.input.up = false;
                    this.input.down = false;
                    this.input.left = false;
                    this.input.right = false;
                }
            });

            // Dedicated touch joystick and dash button for phones/tablets.
            const joystick = document.getElementById('mobileJoystick');
            const knob = document.getElementById('joystickKnob');
            const dashButton = document.getElementById('mobileDash');
            let joystickPointerId = null;
            const updateJoystick = (e) => {
                const rect = joystick.getBoundingClientRect();
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                const maxRadius = Math.max(20, rect.width * 0.29);
                let dx = e.clientX - cx;
                let dy = e.clientY - cy;
                const distance = Math.hypot(dx, dy);
                if (distance > maxRadius) {
                    dx = dx / distance * maxRadius;
                    dy = dy / distance * maxRadius;
                }
                knob.style.transform = `translate(${dx}px, ${dy}px)`;
                const threshold = maxRadius * 0.22;
                this.input.left = dx < -threshold;
                this.input.right = dx > threshold;
                this.input.up = dy < -threshold;
                this.input.down = dy > threshold;
            };
            joystick.addEventListener('pointerdown', (e) => {
                if (this.state !== 'PLAYING') return;
                e.preventDefault();
                joystickPointerId = e.pointerId;
                joystick.setPointerCapture(e.pointerId);
                window.soundManager.init();
                updateJoystick(e);
            });
            joystick.addEventListener('pointermove', (e) => {
                if (e.pointerId === joystickPointerId) {
                    e.preventDefault();
                    updateJoystick(e);
                }
            });
            const releaseJoystick = (e) => {
                if (e && e.pointerId !== joystickPointerId) return;
                joystickPointerId = null;
                knob.style.transform = 'translate(0, 0)';
                this.input.up = this.input.down = this.input.left = this.input.right = false;
            };
            joystick.addEventListener('pointerup', releaseJoystick);
            joystick.addEventListener('pointercancel', releaseJoystick);
            dashButton.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                if (this.state === 'PLAYING') {
                    this.input.dash = true;
                    window.soundManager.init();
                }
            });
            const releaseDash = () => { this.input.dash = false; };
            dashButton.addEventListener('pointerup', releaseDash);
            dashButton.addEventListener('pointercancel', releaseDash);
            dashButton.addEventListener('lostpointercapture', releaseDash);
        }

        handlePointer(e) {
            if (this.state !== 'PLAYING' || !this.player) return;
            const screenCenterX = this.canvas.width / 2;
            const screenCenterY = this.canvas.height / 2;
            const dx = e.clientX - screenCenterX;
            const dy = e.clientY - screenCenterY;
            const threshold = 25;

            this.input.left = dx < -threshold;
            this.input.right = dx > threshold;
            this.input.up = dy < -threshold;
            this.input.down = dy > threshold;
        }

        initUI() {
            // Class picker
            document.querySelectorAll('.class-card').forEach(card => {
                card.addEventListener('click', () => {
                    document.querySelectorAll('.class-card').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                    this.selectedClass = card.getAttribute('data-class');
                });
            });

            // Start Game
            document.getElementById('btnStartGame').addEventListener('click', () => {
                window.soundManager.init();
                this.startGame();
            });

            // Audio & Pause buttons
            document.getElementById('btnAudioToggle').addEventListener('click', () => {
                const isMuted = window.soundManager.toggleMute();
                document.getElementById('btnAudioToggle').textContent = isMuted ? '🔇' : '🔊';
            });
            document.getElementById('btnPauseToggle').addEventListener('click', () => {
                if (this.state === 'PLAYING') this.pauseGame();
            });

            // Pause Modal Buttons
            document.getElementById('btnResume').addEventListener('click', () => this.resumeGame());
            document.getElementById('btnRestartFromPause').addEventListener('click', () => this.startGame());

            // Upgrade Modal Reroll & Skip
            document.getElementById('btnReroll').addEventListener('click', () => {
                if (this.rerollsRemaining > 0) {
                    this.rerollsRemaining--;
                    document.getElementById('btnReroll').disabled = true;
                    document.getElementById('btnReroll').textContent = 'REROLL (0 LEFT)';
                    this.populateUpgradesModal();
                }
            });
            document.getElementById('btnSkipUpgrade').addEventListener('click', () => {
                this.player.hp = Math.min(this.player.maxHp, this.player.hp + 20);
                this.resumeAfterUpgrade();
            });

            // Game Over Play Again
            document.getElementById('btnPlayAgain').addEventListener('click', () => this.startGame());
        }

        loadRecords() {
            this.bestTime = parseInt(localStorage.getItem('neon_horde_best_time') || '0', 10);
            this.bestScore = parseInt(localStorage.getItem('neon_horde_best_score') || '0', 10);
            this.bestKills = parseInt(localStorage.getItem('neon_horde_best_kills') || '0', 10);

            document.getElementById('bestTime').textContent = this.formatTime(this.bestTime);
            document.getElementById('bestScore').textContent = this.bestScore.toLocaleString();
            document.getElementById('bestKills').textContent = this.bestKills.toLocaleString();
        }

        saveRecords() {
            let isNewRecord = false;
            if (this.timeElapsed > this.bestTime) {
                this.bestTime = Math.floor(this.timeElapsed);
                localStorage.setItem('neon_horde_best_time', this.bestTime.toString());
                isNewRecord = true;
            }
            if (this.score > this.bestScore) {
                this.bestScore = this.score;
                localStorage.setItem('neon_horde_best_score', this.bestScore.toString());
                isNewRecord = true;
            }
            if (this.kills > this.bestKills) {
                this.bestKills = this.kills;
                localStorage.setItem('neon_horde_best_kills', this.bestKills.toString());
                isNewRecord = true;
            }
            return isNewRecord;
        }

        startGame() {
            this.state = 'PLAYING';
            this.timeElapsed = 0;
            this.kills = 0;
            this.score = 0;
            this.totalDamageDealt = 0;
            this.rerollsRemaining = 1;
            this.nextBossMilestone = 90;

            this.player = new Player(this.selectedClass);
            this.enemies = [];
            this.enemyBullets = [];
            this.playerProjectiles = [];
            this.damageZones = [];
            this.xpGems = [];
            this.particles = [];
            this.floatingTexts = [];
            this.lightningEffects = [];

            // Reset UI
            document.querySelectorAll('.modal-screen').forEach(m => {
                m.classList.remove('active');
                m.classList.add('hidden');
            });
            document.getElementById('hud').classList.remove('hidden');

            window.soundManager.startMusic();
            this.updateInventoryHUD();
        }

        pauseGame() {
            this.state = 'PAUSED';
            const statsDiv = document.getElementById('pauseStats');
            statsDiv.innerHTML = `
                <div><b>Operative Class:</b> ${this.player.charClass.toUpperCase()}</div>
                <div><b>Level:</b> ${this.player.level}</div>
                <div><b>Max HP:</b> ${Math.round(this.player.maxHp)} | <b>Regen:</b> ${this.player.regenRate.toFixed(1)}/s</div>
                <div><b>Damage Multiplier:</b> ${(this.player.damageMultiplier * 100).toFixed(0)}%</div>
                <div><b>Cooldown Reduction:</b> ${((1 - this.player.cooldownMultiplier) * 100).toFixed(0)}%</div>
                <div><b>Crit Chance:</b> ${(this.player.critChance * 100).toFixed(0)}%</div>
                <div><b>Move Speed:</b> ${this.player.speed.toFixed(0)}</div>
            `;
            const pauseModal = document.getElementById('pauseModal');
            pauseModal.classList.remove('hidden');
            pauseModal.classList.add('active');
        }

        resumeGame() {
            this.state = 'PLAYING';
            const pauseModal = document.getElementById('pauseModal');
            pauseModal.classList.remove('active');
            pauseModal.classList.add('hidden');
        }

        triggerLevelUp() {
            this.state = 'LEVEL_UP';
            document.getElementById('lvlUpHeader').textContent = `LEVEL ${this.player.level} REACHED!`;
            this.populateUpgradesModal();
            const modal = document.getElementById('levelUpModal');
            modal.classList.remove('hidden');
            modal.classList.add('active');
        }

        populateUpgradesModal() {
            const grid = document.getElementById('upgradesGrid');
            grid.innerHTML = '';

            // Filter eligible upgrades (not maxed out)
            const available = UPGRADES_DB.filter(upg => {
                const currentLvl = upg.type === 'weapon'
                    ? (this.player.weapons[upg.id] || 0)
                    : (this.player.passives[upg.id] || 0);
                return currentLvl < upg.maxLevel;
            });

            // Pick 3 random
            const shuffled = [...available].sort(() => 0.5 - Math.random());
            const choices = shuffled.slice(0, 3);

            choices.forEach(upg => {
                const currentLvl = upg.type === 'weapon'
                    ? (this.player.weapons[upg.id] || 0)
                    : (this.player.passives[upg.id] || 0);
                const nextLvl = currentLvl + 1;
                const descText = upg.desc[nextLvl - 1];

                const card = document.createElement('div');
                card.className = 'upgrade-card';
                card.innerHTML = `
                    <div class="upgrade-icon">${upg.icon}</div>
                    <div class="upgrade-name">${upg.name}</div>
                    <div class="upgrade-level-tag">${currentLvl === 0 ? 'NEW!' : `LV ${currentLvl} ➔ LV ${nextLvl}`}</div>
                    <div class="upgrade-desc">${descText}</div>
                `;
                card.addEventListener('click', () => {
                    this.applyUpgrade(upg, nextLvl);
                    this.resumeAfterUpgrade();
                });
                grid.appendChild(card);
            });
        }

        applyUpgrade(upg, nextLvl) {
            if (upg.type === 'weapon') {
                this.player.weapons[upg.id] = nextLvl;
            } else {
                this.player.passives[upg.id] = nextLvl;
                // Apply passive stats
                switch (upg.id) {
                    case 'overclock':
                        this.player.cooldownMultiplier = Math.max(0.45, 1.0 - nextLvl * 0.1);
                        break;
                    case 'titan_plating':
                        this.player.maxHp += 25;
                        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 25);
                        break;
                    case 'vortex_magnet':
                        this.player.pickupRadius = 90 * (1 + nextLvl * 0.5);
                        break;
                    case 'hyper_thrusters':
                        this.player.speed = 220 * (1 + nextLvl * 0.15);
                        if (nextLvl >= 5) this.player.dashCooldown *= 0.75;
                        break;
                    case 'nanite_repair':
                        this.player.regenRate = nextLvl * 1.2;
                        break;
                    case 'crit_targeting':
                        this.player.critChance = 0.08 + nextLvl * 0.1;
                        break;
                }
            }
            this.updateInventoryHUD();
        }

        resumeAfterUpgrade() {
            this.state = 'PLAYING';
            const modal = document.getElementById('levelUpModal');
            modal.classList.remove('active');
            modal.classList.add('hidden');
        }

        updateInventoryHUD() {
            const container = document.getElementById('hudInventory');
            container.innerHTML = '';

            // Weapons
            for (const [id, lvl] of Object.entries(this.player.weapons)) {
                const meta = UPGRADES_DB.find(u => u.id === id);
                if (meta) {
                    const slot = document.createElement('div');
                    slot.className = 'inv-slot';
                    slot.innerHTML = `${meta.icon}<div class="inv-level">${lvl}</div>`;
                    slot.title = `${meta.name} Lv.${lvl}`;
                    container.appendChild(slot);
                }
            }

            // Passives
            for (const [id, lvl] of Object.entries(this.player.passives)) {
                const meta = UPGRADES_DB.find(u => u.id === id);
                if (meta) {
                    const slot = document.createElement('div');
                    slot.className = 'inv-slot';
                    slot.innerHTML = `${meta.icon}<div class="inv-level">${lvl}</div>`;
                    slot.title = `${meta.name} Lv.${lvl}`;
                    container.appendChild(slot);
                }
            }
        }

        triggerGameOver() {
            this.state = 'GAME_OVER';
            window.soundManager.stopMusic();

            const isNew = this.saveRecords();

            document.getElementById('statTime').textContent = this.formatTime(this.timeElapsed);
            document.getElementById('statLevel').textContent = `Lv. ${this.player.level}`;
            document.getElementById('statKills').textContent = this.kills.toLocaleString();
            document.getElementById('statDamage').textContent = this.totalDamageDealt.toLocaleString();
            document.getElementById('statGems').textContent = this.score.toLocaleString();
            document.getElementById('statScore').textContent = this.score.toLocaleString();

            const recordBadge = document.getElementById('newRecordBadge');
            if (isNew) recordBadge.classList.remove('hidden');
            else recordBadge.classList.add('hidden');

            const modal = document.getElementById('gameOverModal');
            modal.classList.remove('hidden');
            modal.classList.add('active');
        }

        // --- Spawners & FX ---
        spawnEnemy() {
            if (!this.player) return;
            const spawnAngle = Math.random() * Math.PI * 2;
            const spawnDist = randRange(600, 850);
            const x = this.player.x + Math.cos(spawnAngle) * spawnDist;
            const y = this.player.y + Math.sin(spawnAngle) * spawnDist;

            // Roll enemy type according to elapsed time
            const r = Math.random();
            let type = 'crawler';
            if (this.timeElapsed > 30 && r < 0.25) {
                type = 'stalker'; // Bat
            } else if (this.timeElapsed > 60 && r > 0.8) {
                type = 'brute'; // Tank
            } else if (this.timeElapsed > 75 && r > 0.65) {
                type = 'shooter';
            }

            this.enemies.push(new Enemy(x, y, type, this.timeElapsed));
        }

        spawnBoss() {
            if (!this.player) return;
            window.soundManager.playBossAlert();
            const banner = document.getElementById('bossBanner');
            banner.classList.remove('hidden');
            setTimeout(() => banner.classList.add('hidden'), 4000);

            const spawnAngle = Math.random() * Math.PI * 2;
            const x = this.player.x + Math.cos(spawnAngle) * 700;
            const y = this.player.y + Math.sin(spawnAngle) * 700;

            this.enemies.push(new Enemy(x, y, 'boss', this.timeElapsed));
        }

        spawnEnemyBullet(x, y, angle, speed, damage) {
            this.enemyBullets.push(new EnemyBullet(x, y, angle, speed, damage));
        }

        detonateBomb(x, y, damage) {
            const radius = 95 * this.player.areaMultiplier;
            this.spawnExplosion(x, y, radius);
            window.soundManager.playExplosion();

            // Direct blast damage
            const nearby = this.grid.getNearby(x, y, radius + 20);
            nearby.forEach(e => {
                if (dist(x, y, e.x, e.y) < radius + e.radius) {
                    const isCrit = Math.random() < this.player.critChance;
                    e.takeDamage(isCrit ? damage * 2 : damage, isCrit, this);
                    e.applyKnockback((e.x - x) * 3, (e.y - y) * 3);
                }
            });

            // Lv.3+ leaves fire puddle
            if (this.player.weapons['bomb'] >= 3) {
                this.damageZones.push(new DamageZone(x, y, radius * 0.75, damage * 0.45, 2.5));
            }
        }

        spawnExplosion(x, y, radius) {
            this.screenShake = 8;
            for (let i = 0; i < 20; i++) {
                const a = Math.random() * Math.PI * 2;
                const spd = randRange(80, 240);
                this.particles.push(new Particle(x, y, Math.cos(a) * spd, Math.sin(a) * spd, '#ff9f1c', randRange(3, 7), 0.4));
            }
        }

        spawnSparks(x, y, color, count) {
            for (let i = 0; i < count; i++) {
                const a = Math.random() * Math.PI * 2;
                const spd = randRange(40, 180);
                this.particles.push(new Particle(x, y, Math.cos(a) * spd, Math.sin(a) * spd, color, randRange(2, 4), randRange(0.2, 0.45), 'spark'));
            }
        }

        spawnLightningBolt(x1, y1, x2, y2) {
            this.lightningEffects.push({ x1, y1, x2, y2, life: 0.12 });
        }

        getNearestEnemies(x, y, maxRadius, count = 1) {
            const candidates = this.grid.getNearby(x, y, maxRadius)
                .filter(e => dist(x, y, e.x, e.y) <= maxRadius)
                .sort((a, b) => dist(x, y, a.x, a.y) - dist(x, y, b.x, b.y));
            return candidates.slice(0, count);
        }

        formatTime(sec) {
            const m = Math.floor(sec / 60);
            const s = Math.floor(sec % 60);
            return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }

        // --- Core Game Loop ---
        loop(timestamp) {
            const dt = Math.min((timestamp - this.lastFrameTime) / 1000, 0.1);
            this.lastFrameTime = timestamp;

            if (this.state === 'PLAYING') {
                this.update(dt);
            }

            this.render();

            requestAnimationFrame(this.loop.bind(this));
        }

        update(dt) {
            this.timeElapsed += dt;

            // Boss milestone
            if (this.timeElapsed >= this.nextBossMilestone) {
                this.spawnBoss();
                this.nextBossMilestone += 90; // Next boss every 90 seconds
            }

            // Wave spawning rate: starts at 1.2s, scales down to 0.12s
            const spawnInterval = Math.max(0.12, 1.2 / (1 + this.timeElapsed * 0.025));
            this.spawnTimer += dt;
            if (this.spawnTimer >= spawnInterval && this.enemies.length < 320) {
                this.spawnTimer = 0;
                this.spawnEnemy();
            }

            // Update Player
            this.player.update(dt, this.input, this);

            // Rebuild Spatial Grid
            this.grid.clear();
            for (let i = 0; i < this.enemies.length; i++) {
                this.grid.insert(this.enemies[i]);
            }

            // Check Glaive Collisions
            this.player.checkGlaiveCollisions(this);

            // Update Enemies & Resolve Soft Separation Collisions
            for (let i = this.enemies.length - 1; i >= 0; i--) {
                const e = this.enemies[i];
                e.update(this.player, dt, this);

                // Simple separation push
                const nearby = this.grid.getNearby(e.x, e.y, e.radius * 2);
                for (let j = 0; j < nearby.length; j++) {
                    const other = nearby[j];
                    if (other !== e) {
                        const d = dist(e.x, e.y, other.x, other.y);
                        const minDist = e.radius + other.radius;
                        if (d > 0 && d < minDist) {
                            const push = (minDist - d) * 0.5;
                            const angle = Math.atan2(e.y - other.y, e.x - other.x);
                            e.x += Math.cos(angle) * push * 0.4;
                            e.y += Math.sin(angle) * push * 0.4;
                        }
                    }
                }

                if (e.hp <= 0) {
                    this.enemies.splice(i, 1);
                }
            }

            // Update Enemy Bullets
            for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
                if (!this.enemyBullets[i].update(dt, this.player, this)) {
                    this.enemyBullets.splice(i, 1);
                }
            }

            // Update Player Projectiles
            for (let i = this.playerProjectiles.length - 1; i >= 0; i--) {
                if (!this.playerProjectiles[i].update(dt, this.player, this.enemies, this)) {
                    this.playerProjectiles.splice(i, 1);
                }
            }

            // Update Damage Zones
            for (let i = this.damageZones.length - 1; i >= 0; i--) {
                if (!this.damageZones[i].update(dt, this.enemies, this)) {
                    this.damageZones.splice(i, 1);
                }
            }

            // Update XP Gems
            for (let i = this.xpGems.length - 1; i >= 0; i--) {
                if (!this.xpGems[i].update(this.player, dt)) {
                    this.xpGems.splice(i, 1);
                }
            }

            // Update Floating Combat Texts
            for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
                if (!this.floatingTexts[i].update(dt)) {
                    this.floatingTexts.splice(i, 1);
                }
            }

            // Update Particles
            for (let i = this.particles.length - 1; i >= 0; i--) {
                if (!this.particles[i].update(dt)) {
                    this.particles.splice(i, 1);
                }
            }

            // Lightning effects decay
            for (let i = this.lightningEffects.length - 1; i >= 0; i--) {
                this.lightningEffects[i].life -= dt;
                if (this.lightningEffects[i].life <= 0) {
                    this.lightningEffects.splice(i, 1);
                }
            }

            // Camera lerp
            const targetCamX = this.player.x - this.canvas.width / 2;
            const targetCamY = this.player.y - this.canvas.height / 2;
            this.cameraX += (targetCamX - this.cameraX) * 0.12;
            this.cameraY += (targetCamY - this.cameraY) * 0.12;

            // Screen shake dampening
            if (this.screenShake > 0) this.screenShake *= 0.9;

            this.updateHUD();
        }

        updateHUD() {
            // Level & XP bar
            document.getElementById('hudLevelBadge').textContent = `LV ${this.player.level}`;
            const xpPct = clamp((this.player.xp / this.player.xpNeeded) * 100, 0, 100);
            document.getElementById('hudXpFill').style.width = `${xpPct}%`;
            document.getElementById('hudXpText').textContent = `${this.player.xp} / ${this.player.xpNeeded} XP`;

            // Metrics
            document.getElementById('hudTimer').textContent = this.formatTime(this.timeElapsed);
            document.getElementById('hudKills').textContent = this.kills;
            document.getElementById('hudScore').textContent = this.score;

            // HP Bar
            const hpPct = clamp((this.player.hp / this.player.maxHp) * 100, 0, 100);
            document.getElementById('hudHpFill').style.width = `${hpPct}%`;
            document.getElementById('hudHpText').textContent = `${Math.ceil(this.player.hp)} / ${Math.ceil(this.player.maxHp)} HP`;

            // Dash Bar
            const dashReadyPct = clamp(100 - (this.player.dashTimer / this.player.dashCooldown) * 100, 0, 100);
            document.getElementById('hudDashFill').style.width = `${dashReadyPct}%`;
        }

        render() {
            const ctx = this.ctx;
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            ctx.save();

            // Screen Shake Offset
            let shakeX = 0, shakeY = 0;
            if (this.screenShake > 0.5) {
                shakeX = (Math.random() - 0.5) * this.screenShake;
                shakeY = (Math.random() - 0.5) * this.screenShake;
            }

            ctx.translate(-Math.floor(this.cameraX + shakeX), -Math.floor(this.cameraY + shakeY));

            // 1. Draw Grid Arena Floor & Boundary
            this.drawArena(ctx);

            // 2. Damage Zones (Puddles)
            this.damageZones.forEach(z => z.draw(ctx));

            // 3. XP Gems
            this.xpGems.forEach(g => g.draw(ctx));

            // 4. Enemies
            this.enemies.forEach(e => e.draw(ctx));

            // 5. Enemy Bullets
            this.enemyBullets.forEach(b => b.draw(ctx));

            // 6. Player
            if (this.player) {
                this.player.draw(ctx);
            }

            // 7. Player Projectiles
            this.playerProjectiles.forEach(p => p.draw(ctx));

            // 8. Lightning Bolts
            this.drawLightning(ctx);

            // 9. Particles
            this.particles.forEach(p => p.draw(ctx));

            // 10. Floating Combat Texts
            this.floatingTexts.forEach(ft => ft.draw(ctx));

            ctx.restore();
        }

        drawArena(ctx) {
            // Dark arena floor
            ctx.fillStyle = '#060810';
            ctx.fillRect(0, 0, this.arenaWidth, this.arenaHeight);

            // Subdued Cyber Grid
            ctx.strokeStyle = 'rgba(0, 243, 255, 0.05)';
            ctx.lineWidth = 1;
            const gridSize = 100;
            ctx.beginPath();
            for (let x = 0; x <= this.arenaWidth; x += gridSize) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, this.arenaHeight);
            }
            for (let y = 0; y <= this.arenaHeight; y += gridSize) {
                ctx.moveTo(0, y);
                ctx.lineTo(this.arenaWidth, y);
            }
            ctx.stroke();

            // Glowing Boundary Barriers
            ctx.strokeStyle = '#00f3ff';
            ctx.lineWidth = 4;
            ctx.shadowColor = '#00f3ff';
            ctx.shadowBlur = 15;
            ctx.strokeRect(0, 0, this.arenaWidth, this.arenaHeight);
            ctx.shadowBlur = 0;
        }

        drawLightning(ctx) {
            ctx.save();
            ctx.strokeStyle = '#ffff55';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#ffff00';
            ctx.shadowBlur = 12;

            this.lightningEffects.forEach(bolt => {
                ctx.beginPath();
                ctx.moveTo(bolt.x1, bolt.y1);
                // Jagged line
                const midX = (bolt.x1 + bolt.x2) / 2 + randRange(-20, 20);
                const midY = (bolt.y1 + bolt.y2) / 2 + randRange(-20, 20);
                ctx.lineTo(midX, midY);
                ctx.lineTo(bolt.x2, bolt.y2);
                ctx.stroke();
            });
            ctx.restore();
        }
    }

    // Initialize Game on Load
    window.addEventListener('DOMContentLoaded', () => {
        window.gameInstance = new Game();
    });
})();
