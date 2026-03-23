# Yggdrasil

A 2D browser-based bullet-hell RPG inspired by **Realm of the Mad God** with **Norse mythology** theming and **Stardew Valley**-style warm UI aesthetics.

Built with **Phaser 3**, **TypeScript**, and **Vite**.

---

## Quick Start

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
| **P** | Force-exit dungeon (emergency) |

---

## Project Structure

```
yggdrasil/
  shared/          # Shared types, enums, constants, balance formulas
  client/          # Phaser 3 game client (Vite + TypeScript)
    src/
      scenes/      # PreloadScene, LoreScene, CharacterSelectScene, GameScene,
                   # DungeonScene, UIScene, DeathScene
      systems/     # PlayerController, AbilitySystem, MusicManager, ProgressManager,
                   # EnemyManager, ProjectileManager
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
- **Boss awakening system**: boss spawns dormant (ghost-like pulse) and dramatically awakens when the player approaches — scale pop, white flash, full alpha
- Boss health bar and boss music both trigger on approach (distance-based, not room-bounds)
- Full HP/MP restore on boss kill; exit portal always spawns on completion
- Per-dungeon music track; boss theme switches on approach

---

### Progression & Persistence

#### Leveling
- XP and leveling with no cap (uncapped, quadratic XP curve)
- Class-specific stat gains per level
- Live **Objective Tracker** (top-right HUD): shows next dungeon goal and current level progress

#### Save System
- **Mid-run state persists across browser refresh** (level, XP, HP, MP, spawned portals)
- Dungeon completion checkpoints saved per class

#### Stage Select (Coffee Golf tour–style)
- Selectable circles in a horizontal path — inspired by [Coffee Golf](https://apps.apple.com/us/app/coffee-golf/id6449750555)'s tour mode level navigation
- Navigate between circles with arrow keys or click; selected circle glows with info panel below
- Click a circle to select, click again (or ENTER) to launch
- **`RUN` circle** — resume your exact saved run (Lv.N)
- **`NEW` circle** — fresh start from level 1
- Named checkpoint circles for fast-travel (Frost, Verdant, Forge, Helheim)
- Unlocked circles are warm/bright, locked circles are dimmed

#### Respawn
- **No permadeath** — 3-second countdown on death, respawn at last spawn point
- All XP, levels, and progress kept on death

#### End Game
- After all 4 dungeons cleared: stat boost (HP, MP, Attack raised to Fenrir-ready levels)
- **Fenrir, The World Ender** waits at the world center as the final battle

---

### Audio
- 4 dungeon music tracks (one per realm), overworld, and boss themes
- Music fades smoothly between scenes; boss track triggers on approach
- 6 SFX: ability use, enemy hit, player hit, heal, level-up, portal enter

> **Generating custom tracks:** run `ELEVENLABS_API_KEY=xxx ./generate-dungeon-audio.sh`

---

## Known Working Features

- ✅ Lore scroll → Character Select → Game loop
- ✅ All 6 classes with unique stats, fire rates, and ability behavior
- ✅ Damage balanced: per-bullet damage within ~30% across all classes
- ✅ Stage select: dot progress bar, single-click confirm, all arrow keys navigate
- ✅ Continue / Fresh Start / Checkpoint options all launch correctly
- ✅ Respawn on death — all progress kept, no permadeath
- ✅ Progress persists across browser refresh (mid-run state)
- ✅ Boss multi-phase transitions (Awakening → Phase 2 → Phase 3)
- ✅ Boss dormant/awakening system with entrance animation
- ✅ Boss phase patterns escalate at 60% and 25% HP (fixed backward-loop bug)
- ✅ Boss hit feedback: SFX, white flash, damage numbers
- ✅ Per-dungeon music keys (unique track per realm)
- ✅ Boss music triggers on approach; full heal on boss kill
- ✅ Exit portal always force-spawns on completion
- ✅ Objective tracker (top-right) shows live level goals
- ✅ Ability widget: class-colored when ready, dark sweep on cooldown
- ✅ Enemy and boss tints restored after damage flash
- ✅ XP bar clamped (no visual overflow)
- ✅ Minimap: dual-scale (biome rings + enemy/portal dots)

---

## 🚧 Known Issues / In Progress

### 🔴 Black screen on dungeon exit (intermittent)
After defeating a dungeon boss and walking through the exit portal, the screen sometimes goes permanently black instead of transitioning back to the Midgard overworld. Root cause traced to three compounding bugs in `DungeonScene.exitDungeon()`:

1. **Failsafe guard was inverted** — the 2s failsafe always fired a second `doSceneTransition` call, corrupting state
2. **Stop timer was scene-scoped** — `this.time.delayedCall` to stop DungeonScene could be cancelled by Phaser's own scene management, leaving the black faded camera active permanently
3. **No once-guard on transition** — multiple concurrent callers could wake GameScene twice

**Status:** Core fix applied (global `window.setTimeout` + `hasTransitioned` guard). May still occur in edge cases across all 4 dungeons. Under active investigation.

---

### 🔴 Final boss (Fenrir) not activating correctly
After clearing all 4 dungeons, **Fenrir** spawns at the world center in the Midgard overworld. Currently:
- Boss may remain in the dormant ghost state (semi-transparent) if the distance-based awakening trigger doesn't fire
- Boss attack phases may not escalate as intended in the overworld context (separate code path from dungeon bosses)
- Hit registration on the final boss needs verification

**Status:** Dungeon bosses are confirmed working. Fenrir uses a separate boss system in `GameScene.ts` that requires a dedicated pass to bring it in line with the dungeon boss improvements.

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

---

## Balance Notes

```ts
// Damage taken
damage_taken = max(baseDamage − defense, baseDamage × 0.15)

// Move speed
moveSpeed = 80 + speedStat × 1.5

// HP regen
hpRegen = 1 + vitality × 0.12   // per second

// XP curve (uncapped)
xpForLevel(n) = 50 × (n−1)²
```

Multi-bullet classes (Viking 5×, Berserker 3×, Valkyrie 3×) have their `damageMultiplier` set directly in `ClassDatabase.ts` so per-bullet damage is transparent and easily tunable. No hidden code penalty.

---

## License

Private — Space City Studios
