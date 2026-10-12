# ⚡ NEON HORDE: SURVIVORS

An action-packed, fully featured top-down horde survival rogue-lite browser game built with **pure HTML5 Canvas, JavaScript, CSS3**, and the **Web Audio API**.

Zero external audio files or third-party runtime dependencies required. Runs directly in any modern web browser.

---

## 🎮 How to Play

### 1. Launching the Game
- **Quick Launch (Windows)**: Double-click [`start_game.bat`](start_game.bat)
- **Direct**: Open [`index.html`](index.html) in your browser (Chrome, Edge, Firefox, Safari).
- **Via Local Server (Optional)**:
  ```bash
  python -m http.server 8000
  # Then open http://localhost:8000 in your browser
  ```

---

## 🕹️ Controls

| Action | Keyboard / Mouse |
| :--- | :--- |
| **Move Operative** | <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or <kbd>Arrow Keys</kbd> (or click/drag mouse) |
| **Dash / Dodge** | <kbd>Space</kbd> or <kbd>Shift</kbd> (invulnerability frames during dash) |
| **Aim & Attack** | Autonomous intelligent auto-targeting |
| **Tactical Pause** | <kbd>Esc</kbd> or <kbd>P</kbd> |
| **Audio Toggle** | Click the 🔊 button in the top right |

---

## 🦸 Operative Classes

1. **Cyber Mage**
   - **Primary Weapon**: Plasma Wand
   - **Traits**: +25% Projectile Velocity, -10% Cooldown interval.
2. **Blade Dancer**
   - **Primary Weapon**: Orbital Glaive
   - **Traits**: +20% Movement Speed, -30% Dash cooldown.
3. **Pyro Grenadier**
   - **Primary Weapon**: Plasma Bomb
   - **Traits**: +35 Max HP, +30% Explosive Area of Effect.

---

## ⚔️ Weapon Arsenal & Synergies

Each weapon can be upgraded to **Level 5**:

1. **Plasma Wand (`⚡`)**: Rapid-fire plasma bolts targeting the nearest enemies. Gains multi-shot and pierce at higher levels.
2. **Orbital Glaive (`⚔️`)**: Orbiting energy blades that slice through enemies and knock them back. Adds up to 3 orbiting blades and expanded radius.
3. **Lightning Storm (`🌩️`)**: Instantaneous lightning strikes targeting multiple hostiles with electrical shockwaves.
4. **Plasma Bomb (`💣`)**: Lobs explosive charges that deal AoE damage and leave burning fire puddles on the ground.
5. **Piercing Scythe (`🪃`)**: Energy boomerang that cuts back and forth across swarms, releasing a kinetic pulse.

### 🛡️ Passive Upgrades
- **Overclock Chip**: Reduces cooldown on all equipped weapons by up to 45%.
- **Titan Plating**: Increases maximum HP and instantly restores health.
- **Vortex Magnet**: Dramatically expands energy gem collection range.
- **Hyper Thrusters**: Boosts operative agility and movement speed.
- **Nanite Repair**: Continuous passive health regeneration.
- **Crit Targeting**: Increases critical strike chance up to 50% for 2x damage.

---

## 👾 Enemy Hostiles & Swarms

- **Crawlers**: Fast, abundant neon cyber-drones.
- **Stalkers**: High-speed interceptor bats that dart unpredictably.
- **Brutes**: Massive armored mechs with high health and knockback resistance.
- **Shooters**: Ranged droid turrets that keep distance and fire plasma projectiles.
- **Apex Goliath (Boss)**: Colossal boss with a health bar and radial bullet spray. Drops super gem caches on defeat!

---

## 🔊 Procedural Audio Engine

All sound effects and retro synthwave music are generated mathematically in real-time using the **Web Audio API**:
- Laser shoots & explosions synthesized via oscillators and custom envelopes.
- **Musical Gem Streak**: Collecting consecutive energy gems plays ascending pentatonic notes.
- Procedural multi-track bassline, lead arpeggiator, and rhythmic kick/pulse.

---

## 💾 Persistence

High scores, survival time, and kill records are automatically preserved across sessions via `localStorage`.
