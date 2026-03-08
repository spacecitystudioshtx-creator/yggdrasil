# Yggdrasil

A 2D browser-based bullet-hell RPG inspired by **Realm of the Mad God** with **Norse mythology** theming and **Stardew Valley**-style warm UI aesthetics.

Built with **Phaser 3**, **TypeScript**, and **Vite**.

## Quick Start

```bash
# Install dependencies
npm install

# Start the dev server
cd client && npm run dev
```

Open `http://localhost:5173` in your browser.

## Controls

| Key | Action |
|---|---|
| **WASD** | Move (8-directional) |
| **Mouse** | Aim |
| **Left Click** | Shoot |
| **Space** | Use special ability |
| **M** | Toggle World Map overlay |
| **R** | Return to Asgard (safe hub) |
| **E** | Interact with NPCs (in Asgard) |
| **Arrow Keys** | Navigate menus |
| **Enter** | Confirm selection |

## Project Structure

```
yggdrasil/
  shared/          # Shared types, enums, constants, balance formulas
  client/          # Phaser 3 game client (Vite + TypeScript)
    src/
      scenes/      # Boot, Preload, Lore, CharacterSelect, Game, Dungeon, Nexus, Death, UI
      systems/     # PlayerController, EnemyManager, ProjectileManager, AbilitySystem,
                   # LootManager, FameManager, CameraController, MusicManager, ProgressManager
      data/        # ItemDatabase, DungeonDatabase, ClassDatabase
      utils/       # SpriteGenerator, ObjectPool, MathUtils
  server/          # Content API server (placeholder)
```

## What's Built

### Opening Lore Crawl
- Norse mythology intro with scrolling text (Star Wars-style crawl)
- Sets the stage: Ragnarok approaches, Odin calls mortal heroes
- Skippable after 1.5 seconds by pressing any key or clicking
- Smooth fade transition to character select
- Overworld music begins on the lore screen

### Core Game Loop
- Procedurally generated 256×256 tile world using Perlin noise
- 4 concentric biome zones: Frozen Shores → Birch Forest → Volcanic Wastes → Niflheim Depths
- Difficulty scales as you move toward the center of the world
- WASD movement with mouse-aim shooting
- Pixel-perfect camera follow with 2× zoom
- Circular minimap with biome rings, enemy dots, portal markers

### 6 Classes with Unique Combat Profiles

Each class has a completely different combat feel via unique weapon profiles:

| Class | Weapon | Armor | Combat Style |
|---|---|---|---|
| **Viking** | Sword / Heavy | 5 projectiles, 90° arc, short range | Melee tank burst |
| **Runemaster** | Staff / Robe | 2 projectiles, tight spread, long range | Sniper mage |
| **Valkyrie** | Spear / Medium | 3 projectiles, 15° cone, mid range | Balanced hybrid |
| **Berserker** | Axe / Light | 3 projectiles, 45° arc, fast fire | Glass cannon |
| **Skald** | Wand / Robe | 1 projectile, very long range, slow | Support caster |
| **Huntsman** | Bow / Light | 1 projectile, fastest fire rate, long range | Rapid archer |

- Class-specific projectile speed, lifetime, tint, size, and damage multipliers
- Class-specific base stats, level gains, and stat caps
- Character select screen with full stat previews and lore

### Ability System (Space Bar)
- **1 signature ability per class**, always available from level 1
- Each ability has its own cooldown, MP cost, and visual color (shown in the HUD)
- Ability types:
  - **Healing** (Valkyrie Divine Touch, Skald Healing Chant)
  - **Defense buffs** (Viking Shield Wall, Runemaster Arcane Shield)
  - **Attack speed** (Berserker Frenzy)
  - **AoE damage** (Viking Battle Cry / Odin's Fury)
  - **Projectile bursts** (Runemaster Rune Blast, Huntsman Arrow Volley)
- HUD widget at bottom-center: shows ability name, class color, cooldown sweep, READY state
- Ability is shown prominently on the Character Select detail panel

### Combat
- Object-pooled projectile system (200 player, 500 enemy)
- 7 enemy bullet pattern types: Aimed, Radial, Spiral, Shotgun, Wall, Star, Burst
- Class-specific weapon profiles (projectile count, spread, speed, lifetime, size, tint)
- Damage calculation with defense scaling and damage multipliers
- Floating damage numbers
- Invincibility frames after hit
- Class tint preserved through damage flashes
- Projectiles stop on wall collision in dungeons

### Instant Heal Drops (no inventory)
- 50% chance of an instant heal (+8% max HP) on every enemy kill
- Green sparkle effect + floating `+HP` text at kill site
- Boss kill fully restores HP and MP
- No loot bags, no inventory panel — streamlined for fast action gameplay

### Enemies
- Chunk-based spawning in overworld within render distance
- AI state machine: wander when idle, chase and attack on aggro
- Stats scale with biome difficulty (level 1–20)
- Health bars shown on damaged enemies
- Despawn when out of range (overworld)

### Dungeons (Four Realms)
- 4 dungeons unlocking at levels 5, 6, 8, 10:
  - **Frostheim Caverns** (difficulty 1)
  - **Verdant Hollows** (difficulty 3)
  - **Muspelheim Forge** (difficulty 5)
  - **Helheim Sanctum** (difficulty 8)
- Procedural snake-path room generation with varying room sizes
- 3–5 enemies per room; idle until player enters, then chase until dead
- Projectiles stop on dungeon walls (no shooting through walls)
- Multi-phase boss fights with Norse dialogue and escalating bullet patterns
- Boss health bar appears when player approaches boss room
- Full HP/MP restore on boss kill
- Exit portal spawns on boss defeat — walk into it to return to Midgard
- Camera tight-follow in dungeons (no aim offset)
- Dungeon portals appear next to player when reaching the unlock level

### Asgard Hub (Nexus)
- Safe zone with no enemies or damage
- Handcrafted golden-tile map with rooms
- Vault Keeper NPC: store items that survive death (localStorage)
- Shop Keeper NPC: buy basic gear
- Bifrost Portal: enter Midgard overworld
- R key to return from overworld at any time

### Progression & Persistence
- XP and leveling (1–20) with class-specific stat gains per level
- Run progress **persists across browser refresh** (level, XP, HP, MP, spawned portals saved to localStorage)
- Dungeon completion checkpoints saved per class — fast-travel to cleared stages on future runs
- **Stage Select overlay** on character select (Mario World style):
  - `► Continue (Lv.N)` — resume your exact saved run
  - `Midgard (Fresh Start)` — start from level 1
  - Unlocked checkpoints (e.g. "Frostheim Cleared") for fast travel
- Permadeath: death wipes the run state, character is lost
- Fame system: earn fame based on level, kills, dungeons, biomes explored
- Dormant Fenrir at world center — awakens after all 4 dungeons cleared (final boss)

### Audio
- 3 music tracks generated with ElevenLabs (Viking/RuneScape style):
  - Overworld: lute + flute melody, steady drum, Scandinavian folk
  - Dungeon: deep droning strings, ominous bass, stone cavern feel
  - Boss: war drums, Norse horns, tribal Viking percussion
- Music fades between scenes; boss track triggers when approaching boss room
- 6 SFX: ability use, enemy hit, player hit, heal, level up, portal enter
- Overworld music starts on lore screen and continues through character select

### UI
- Warm earth-tone palette: wooden panel borders, parchment interiors
- HP / MP / XP bars in top-left panel
- Ability widget at bottom-center: class-colored border when ready, grey sweep on cooldown
- World map overlay (M key) with biome visualization and portal markers
- Notification toasts with color-coded messages
- Death screen with permadeath countdown
- Character select with class previews, stat bars, and ability info panel

## Dungeon Progression Flow

```
Level 1  → Midgard overworld (kill enemies, gain XP)
Level 5  → Frostheim Caverns portal appears
Level 6  → Verdant Hollows portal appears (after Frostheim)
Level 8  → Muspelheim Forge portal appears
Level 10 → Helheim Sanctum portal appears
All done → FENRIR awakens at world center (final fight)
Win      → Victory ending screen
```

## Norse Mythology Mapping

| Game Concept | Norse Equivalent |
|---|---|
| Safe Hub | Asgard (Nexus) |
| Overworld | Midgard (procedural realm) |
| Starter zone | Frozen Shores |
| Mid zone | Birch Forest |
| Hard zone | Volcanic Wastes / Muspelheim Border |
| Core zone | Niflheim Depths |
| Dungeons | Frostheim, Verdant Hollows, Muspelheim Forge, Helheim |
| Final Boss | Fenrir, The World Ender |
| Fame | Earned on death, permanent progress |
| Vault | Death-safe item storage in Asgard |

## Tech Stack

- **Phaser 3** (v3.87) — 2D game framework with Arcade physics
- **TypeScript** — Strict mode, shared types across packages
- **Vite** — Fast dev server and build tool
- **npm workspaces** — Monorepo (client / shared)
- **ElevenLabs API** — Procedurally generated music and SFX
- **localStorage** — Run state, checkpoints, vault, and fame persistence

## Known Working Features (as of latest build)

- ✅ Lore scroll → Character Select → Game loop
- ✅ All 6 classes with unique weapons and abilities
- ✅ Stage Select with Continue / Fresh Start / Checkpoint options
- ✅ Progress persists across browser refresh
- ✅ 4 dungeons with level-gated portals
- ✅ Projectiles blocked by dungeon walls
- ✅ Boss health bar (lazy-loads when player approaches)
- ✅ Boss music triggers on approach, not on dungeon entry
- ✅ Full heal on boss kill, no loot bags
- ✅ Exit portal returns to Midgard cleanly (no freeze, no black screen)
- ✅ Viking/RuneScape-style music in all contexts
- ✅ Ability widget shows correct class color (dark when cooling, colored when ready)

## License

Private — Space City Studios
