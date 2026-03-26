# Yggdrasil

A 2D browser-based bullet-hell RPG inspired by **Realm of the Mad God** with **Norse mythology** theming and **Stardew Valley**-style warm UI aesthetics.

Built with **Phaser 3**, **TypeScript**, and **Vite**.

---

## Play the Game

The game is deployed via **GitHub Pages**. Check the repository's **Settings → Pages** for the live URL, or look for the link in the **About** section of this repo.

Also available on **CrazyGames** (landscape orientation, desktop & mobile).

---

## Quick Start (Local Development)

```bash
npm install
cd client && npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Controls

| Key | Action |
|---|---|
| **WASD** | Move (8-directional) |
| **Mouse** | Aim |
| **Left Click** | Shoot |
| **Space** | Use special ability |
| **M** | Toggle world map overlay |
| **P** | Pull dungeon portal to player |

**Mobile:** On-screen joystick (left) and fire button (right). Hidden on desktop.

---

## Project Structure

```
yggdrasil/
  shared/          # Shared types, enums, constants, balance formulas
  client/          # Phaser 3 game client (Vite + TypeScript)
    src/
      scenes/      # BootScene, PreloadScene, LoreScene, CharacterSelectScene,
                   # GameScene, DungeonScene, UIScene, DeathScene, EndingScene,
                   # NexusScene
      systems/     # PlayerController, AbilitySystem, MusicManager, ProgressManager,
                   # EnemyManager, ProjectileManager, InputManager
      data/        # ClassDatabase, DungeonDatabase
      utils/       # SpriteGenerator, ObjectPool
  server/          # Placeholder (unused)
```

---

## What's Built

### Opening Lore Crawl
- Norse mythology intro with scrolling text (Star Wars–style crawl)
- Sets the stage: Ragnarök approaches, Odin calls mortal heroes
- Skippable after 1.5 seconds; smooth fade transition to character select
- Overworld music begins on the lore screen

---

### Core Game Loop
- Procedurally generated 256×256 tile world using Perlin noise
- 4 concentric biome zones: Frozen Shores → Birch Forest → Volcanic Wastes → Niflheim Depths
- Difficulty scales as you move toward the world center
- WASD movement with mouse-aim shooting
- Pixel-perfect camera follow with 2× zoom
- Circular minimap with biome rings, enemy dots, portal markers

---

### 6 Classes with Unique Combat Profiles

| Class | Style | Ability |
|---|---|---|
| **Viking** | 5-bullet burst, high defense | **Shield Wall** — halve all damage for 5s |
| **Runemaster** | High single-shot damage, slow fire | **Rune Blast** — 12 arcane bolts in a ring |
| **Valkyrie** | 3-bullet balanced hybrid | **Divine Touch** — restore 80 HP instantly |
| **Berserker** | 3-bullet glass cannon | **Frenzy** — +50% fire rate for 5s |
| **Skald** | Long-range support caster | **Healing Chant** — restore 100 HP (MP cost) |
| **Huntsman** | Single-shot, fastest fire rate | **Arrow Volley** — 8-arrow wide cone burst |

- Class-specific projectile speed, tint, spread, and damage multipliers
- Balanced DPS across all classes: per-bullet damage within 30% of the strongest class
- Character select with full stat previews, ability info, and lore

---

### Ability System
- 1 signature ability per class (Space Bar), available from level 1
- **Cooldown-gated**: Viking, Berserker, Valkyrie, Huntsman
- **MP-gated**: Runemaster, Skald — no cooldown timer, purely mana-limited
- HUD widget: class-colored border when ready, dark sweep on cooldown

---

### Combat
- Object-pooled projectile system (200 player, 500 enemy)
- 7 enemy bullet pattern types: Aimed, Radial, Spiral, Shotgun, Wall, Star, Burst
- Defense formula: `damage_taken = max(damage − defense, damage × 0.15)`
- Floating damage numbers, invincibility frames on hit, class tint preserved through flashes
- Projectiles blocked by dungeon walls

---

### Enemies
- Chunk-based spawning in overworld within render distance
- AI state machine: wander → aggro → chase → attack
- Stats scale with biome difficulty
- Health bars shown on damaged enemies

---

### Dungeons (Four Realms)

| Dungeon | Unlock | Difficulty | Theme |
|---|---|---|---|
| **Frostheim Caverns** | Lv 5 | 3 | Ice blue, Hrimthursar boss |
| **Verdant Hollows** | Lv 6 (after Frostheim) | 5 | Green, Thornwarden boss |
| **Muspelheim Forge** | Lv 8 (after Verdant) | 8 | Orange flame, Ember Tyrant boss |
| **Helheim Sanctum** | Lv 10 (after Muspelheim) | 10 | Void purple, Hel herself |

- Procedural snake-path room generation with varying room sizes
- 3–5 enemies per room; idle until player enters, then aggro
- **Multi-phase boss fights**: phases escalate at 60% and 25% HP with new bullet patterns and dialogue
- **Boss awakening system**: boss spawns dormant (ghost-like pulse) and dramatically awakens when the player approaches
- Boss health bar and boss music both trigger on approach
- Full HP/MP restore on boss kill; exit portal always spawns on completion
- Per-dungeon music track; boss theme switches on approach

---

### Fenrir — The Final Boss
- **Progressive reveal**: becomes more visible as each dungeon is cleared (alpha 0.15 → 1.0)
- Dormant at world center firing warning shots; fully awakens after all 4 dungeons cleared
- 1.8× stat boost granted to player for the fight
- **3 escalating phases**: Spiral (phase 1) → Double spiral + aimed (phase 2) → Dense ring + triple aimed burst (phase 3)
- Chase range 450px, increasing speed per phase
- Dramatic death animation with flash sequence and expand-fade
- Transitions to EndingScene epilogue on defeat

---

### Ending Sequence
- Scrolling epilogue matching the opening lore crawl style
- Reveals the story twist: "Fenrir was never the threat. Fenrir was the lock."
- Credits roll with studio attribution
- Post-credits: Endless Mode prompt or New Game option

---

### Progression & Persistence

#### Leveling
- XP and leveling with no cap (uncapped, quadratic XP curve)
- Class-specific stat gains per level
- Live **Objective Tracker** (top-right HUD): shows next dungeon goal and current level progress

#### Save System
- **Mid-run state persists across browser refresh** (level, XP, HP, MP, spawned portals)
- Dungeon completion checkpoints saved per class
- **CrazyGames Data Module** support: syncs progress cross-device for logged-in players
- Falls through to localStorage when Data Module is unavailable

#### Stage Select (Coffee Golf tour-style)
- Selectable circles in a horizontal path
- Navigate between circles with arrow keys or click; selected circle glows with info panel below
- **`RUN` circle** — resume your exact saved run (Lv.N)
- **`NEW` circle** — fresh start from level 1
- Named checkpoint circles for fast-travel (Frost, Verdant, Forge, Helheim)
- Unlocked circles are warm/bright, locked circles are dimmed
- Back button to return to character select

#### Respawn
- **No permadeath** — 3-second countdown on death, respawn at last spawn point
- All XP, levels, and progress kept on death

---

### Multi-Platform Support
- **Desktop**: Full keyboard + mouse controls
- **Mobile**: Touch joystick and fire button (auto-hidden on desktop)
- **CrazyGames SDK v3**: Loading/gameplay lifecycle signals, mute support, Data Module saves
- **Conditional SDK loading**: CrazyGames SDK only loads on CrazyGames domains, preventing load issues elsewhere
- **Null-safe keyboard access**: All keyboard bindings use optional chaining for touch-only devices

---

### Audio
- 4 dungeon music tracks (one per realm), overworld, and boss themes
- Music fades smoothly between scenes; boss track triggers on approach
- 6 SFX: ability use, enemy hit, player hit, heal, level-up, portal enter
- CrazyGames mute integration (global `game.sound.mute`)

> **Generating custom tracks:** run `ELEVENLABS_API_KEY=xxx ./generate-dungeon-audio.sh`

---

## Tech Stack

| Tool | Purpose |
|---|---|
| **Phaser 3** (v3.87) | 2D game framework, Arcade physics |
| **TypeScript** | Strict mode, shared types across packages |
| **Vite** | Fast dev server + build |
| **npm workspaces** | Monorepo (client / shared) |
| **ElevenLabs API** | Procedurally generated music and SFX |
| **localStorage** | Run state, checkpoints, and progress persistence |
| **CrazyGames SDK v3** | Platform integration (saves, mute, lifecycle) |
| **GitHub Pages** | Automated deployment via Actions |

---

## Balance Notes

```ts
// Damage taken
damage_taken = max(baseDamage - defense, baseDamage * 0.15)

// Move speed
moveSpeed = 80 + speedStat * 1.5

// HP regen
hpRegen = 1 + vitality * 0.12   // per second

// XP curve (uncapped)
xpForLevel(n) = 50 * (n-1)^2

// Fenrir boss: 35,000 HP, 1.5% per hit, max 5 hits/sec (damage cooldown)
// Player boost for Fenrir fight: 1.8x HP/MP/ATK/DEF, 1.3x SPD, 1.5x DEX
```

Multi-bullet classes (Viking 5×, Berserker 3×, Valkyrie 3×) have their `damageMultiplier` set directly in `ClassDatabase.ts` so per-bullet damage is transparent and easily tunable. No hidden code penalty.

---

## License

Private — Space City Studios
