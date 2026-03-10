# Yggdrasil

A 2D browser-based bullet-hell RPG inspired by **Realm of the Mad God** with **Norse mythology** theming and **Stardew Valley**-style warm UI aesthetics.

Built with **Phaser 3**, **TypeScript**, and **Vite**.

---

## Quick Start

```bash
# Install dependencies
npm install

# Start the dev server
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
| **M** | Toggle World Map overlay |

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
- Skippable after 1.5 seconds by pressing any key or clicking
- Smooth fade transition to character select
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

| Class | Combat Style | Signature Ability |
|---|---|---|
| **Viking** | 5-bullet melee burst, tanky | **Shield Wall** — halve all damage for 5 s |
| **Runemaster** | High single-shot damage, slow fire | **Rune Blast** — erupt 12 arcane bolts in a ring |
| **Valkyrie** | 3-bullet balanced hybrid | **Divine Touch** — restore 80 HP instantly |
| **Berserker** | 3-bullet glass cannon, fastest burst | **Frenzy** — +50% fire rate for 5 s |
| **Skald** | Long-range support caster | **Healing Chant** — restore 100 HP (costs MP) |
| **Huntsman** | Single-shot, fastest fire rate | **Arrow Volley** — 8-arrow wide cone burst |

- Class-specific projectile speed, lifetime, tint, size, and damage multipliers
- Class-specific base stats, per-level gains, and stat caps
- Character select with full stat previews, ability info, and lore

---

### Ability System (Space Bar)
- 1 signature ability per class, available from level 1
- Each ability has its own cooldown and/or MP cost
- HUD widget at bottom-center: class-colored border when ready, dark sweep on cooldown
- **Cooldown-gated**: Viking (Shield Wall), Berserker (Frenzy), Valkyrie (Divine Touch), Huntsman (Arrow Volley)
- **MP-gated**: Runemaster (Rune Blast), Skald (Healing Chant) — no cooldown, purely mana-limited

---

### Combat
- Object-pooled projectile system (200 player, 500 enemy)
- 7 enemy bullet pattern types: Aimed, Radial, Spiral, Shotgun, Wall, Star, Burst
- Defense formula: `damage_taken = max(damage − defense, damage × 0.15)` — defense never trivializes damage
- Multi-bullet penalty: classes with 3–5 projectiles deal 50% damage per bullet (balanced DPS)
- Floating damage numbers, invincibility frames, class tint preserved through hit flashes
- Projectiles blocked by dungeon walls

---

### Instant Heal Drops (no inventory)
- 50% chance of an instant heal (+8% max HP) on every enemy kill
- Green sparkle effect + floating `+HP` text at kill site
- Boss kill fully restores HP and MP
- No loot bags, no inventory panel — streamlined for fast action

---

### Enemies
- Chunk-based spawning in overworld within render distance
- AI state machine: wander → aggro → chase → attack
- Stats scale with biome difficulty
- Health bars shown on damaged enemies
- Despawn when out of range

---

### Dungeons (Four Realms)

| Dungeon | Unlock Level | Difficulty | Theme |
|---|---|---|---|
| **Frostheim Caverns** | Lv 5 | 3 | Ice blue, Frost Warden boss |
| **Verdant Hollows** | Lv 6 (after Frostheim) | 5 | Green, Thornwarden boss |
| **Muspelheim Forge** | Lv 8 (after Verdant) | 8 | Orange flame, Ember Tyrant boss |
| **Helheim Sanctum** | Lv 10 (after Muspelheim) | 10 | Purple, Hel herself |

- Procedural snake-path room generation with varying room sizes
- 3–5 enemies per room; idle until player enters, then chase until dead
- Multi-phase boss fights with Norse dialogue and escalating bullet patterns
- Boss health bar lazy-loads when player approaches the boss room
- Per-dungeon music track that switches to boss theme on approach
- Full HP/MP restore on boss kill
- Exit portal spawns on boss defeat — walk into it to return to Midgard
- Portal re-spawns correctly after browser refresh (exact portal state is persisted)

---

### Progression & Persistence

#### Leveling
- XP and leveling **1–30** with class-specific stat gains per level
- Quadratic XP curve (fast early levels, steady pace to cap)
- Live **Objective Tracker** (top-right HUD): shows the next dungeon goal and current level progress

#### Save System
- **Mid-run state persists across browser refresh** (level, XP, HP, MP, spawned portals, dungeon progress)
- Dungeon completion checkpoints saved per class

#### Stage Select (Character Select screen)
- `► Continue (Lv.N)` — resume your exact saved run at the level and HP you left off
- `Midgard (Fresh Start)` — start from level 1
- Unlocked named checkpoints (e.g. "Frostheim Cleared") for fast travel to later stages

#### Respawn
- **No permadeath** — on death, a 3-second countdown plays and you respawn at your last spawn point
- All XP, level, and progress is kept on death
- Run state is re-saved on respawn so browser refresh is safe even after dying

#### End Game
- After all 4 dungeons cleared: stat boost (HP, MP, Attack raised to Fenrir-ready levels)
- **Fenrir, The World Ender** waits at the world center as the final battle

---

### Audio
- 4 dungeon music tracks (one per realm), plus overworld and boss themes:
  - `music_overworld` — lute + flute melody, Scandinavian folk
  - `music_dungeon_frost` — cold ambient, icy strings
  - `music_dungeon_verdant` — nature drone, deep forest
  - `music_dungeon_muspelheim` — forge percussion, war drums *(reference difficulty track)*
  - `music_dungeon_helheim` — dark Norse horns, ominous bass
  - `music_boss` — tribal Viking percussion, intensifying layers
- Music fades smoothly between scenes; boss track triggers on room approach
- 6 SFX: ability use, enemy hit, player hit, heal, level-up, portal enter

> **Generating custom tracks:** run `ELEVENLABS_API_KEY=xxx ./generate-dungeon-audio.sh` (ElevenLabs API key required)

---

### UI & Readability
- Warm earth-tone palette: wooden panel borders, parchment interiors
- HP / MP / XP bars — bold white text with black stroke for maximum legibility
- Level display — gold bold text with black stroke
- **Objective Tracker** (top-right) — live dungeon progression goals ("▶ Kill to Lv.5 → Frostheim Caverns")
- Ability widget (bottom-center) — class-colored when ready, dark sweep on cooldown
- Notification toasts — bold 14px with heavy stroke
- World map overlay (M key) with biome visualization and portal markers
- Character select: full stat bars, lore panel, and ability detail

---

## Dungeon Progression Flow

```
Level 1   → Midgard overworld — kill enemies, gain XP
Level 5   → Frostheim Caverns portal appears
Lv 6+     → Verdant Hollows portal appears (after Frostheim cleared)
Lv 8+     → Muspelheim Forge portal (after Verdant cleared)
Lv 10+    → Helheim Sanctum portal (after Muspelheim cleared)
All done  → Stat boost + FENRIR awakens at world center
Win       → Victory!
```

---

## Norse Mythology Mapping

| Game Concept | Norse Equivalent |
|---|---|
| Overworld | Midgard (procedural realm) |
| Starter biome | Frozen Shores |
| Dungeons | Frostheim, Verdant Hollows, Muspelheim Forge, Helheim |
| Final Boss | Fenrir, The World Ender |

---

## Balance

Key formulas (see `shared/src/constants/balance.ts`):

```ts
// Damage
damage_taken = max(baseDamage − defense, baseDamage × 0.15)

// Move speed
moveSpeed = 80 + speedStat × 1.5

// HP regen
hpRegen = 1 + vit × 0.12   // per second

// XP curve
xpForLevel(n) = 50 × (n−1)²   // levels 1–30
```

---

## Tech Stack

| Tool | Purpose |
|---|---|
| **Phaser 3** (v3.87) | 2D game framework, Arcade physics |
| **TypeScript** | Strict mode, shared types across packages |
| **Vite** | Fast dev server + build |
| **npm workspaces** | Monorepo (client / shared) |
| **ElevenLabs API** | Procedurally generated music and SFX |
| **localStorage** | Run state, checkpoints, and fame persistence |

---

## Known Working Features

- ✅ Lore scroll → Character Select → Game loop
- ✅ All 6 classes with accurate ability names/descriptions matching actual behavior
- ✅ Stage Select with Continue / Fresh Start / Checkpoint options
- ✅ Respawn on death (no permadeath) — all progress kept
- ✅ Progress persists across browser refresh (mid-run state)
- ✅ Portal re-spawns correctly on refresh after dungeon completion
- ✅ Objective tracker (top-right) shows live level goals and next dungeon
- ✅ 4 dungeons with level-gated portals, sequential unlock flow
- ✅ Per-dungeon music keys (unique track per realm)
- ✅ Boss health bar (lazy-loads when player enters boss room bounds)
- ✅ Boss music triggers on approach, not on dungeon entry
- ✅ Full heal on boss kill; portal always force-spawns on completion
- ✅ Enemy and boss tints restored after damage flash
- ✅ XP bar clamped (no visual overflow)
- ✅ Ability widget: dark on cooldown, class-colored when ready
- ✅ Bold high-contrast text across all HUD elements
- ✅ Minimap: dual-scale (biome rings + enemy/portal dots)

---

## License

Private — Space City Studios
