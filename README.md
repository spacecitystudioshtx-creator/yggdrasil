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
| **Space** | Use ability (3 progressive abilities per class) |
| **I** | Toggle Inventory |
| **J** | Toggle Quest Journal |
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
                   # InventoryManager, QuestManager, LootManager, FameManager, CameraController
      data/        # ItemDatabase, QuestDatabase, DungeonDatabase, ClassDatabase
      utils/       # SpriteGenerator, ObjectPool, MathUtils
  server/          # Content API server (placeholder for Phase 4)
```

## What's Built (Phases 1-6)

### Opening Lore Crawl
- Norse mythology intro with scrolling text (Star Wars-style crawl)
- Sets the stage: Ragnarok approaches, Odin calls mortal heroes
- Skippable after 1.5 seconds by pressing any key or clicking
- Smooth fade transition to character select

### Core Game Loop
- Procedurally generated 256x256 tile world using Perlin noise
- 4 concentric biome zones: Frozen Shores, Birch Forest, Volcanic Wastes, Niflheim Depths
- Difficulty scales as you move toward the center of the world
- WASD movement with mouse-aim shooting
- Pixel-perfect camera follow with 2x zoom
- Circular minimap with biome rings, enemy dots, portal markers

### 6 Starter Classes with Unique Combat Profiles

Each class has a completely different combat feel via unique weapon profiles:

| Class | Weapon | Armor | Combat Style |
|---|---|---|---|
| **Viking** | Sword / Heavy | 5 projectiles, 90 degree arc, short range | Melee tank burst |
| **Runemaster** | Staff / Robe | 2 projectiles, tight spread, long range | Sniper mage |
| **Valkyrie** | Spear / Medium | 3 projectiles, 15 degree cone, mid range | Balanced hybrid |
| **Berserker** | Axe / Light | 3 projectiles, 45 degree arc, fast fire | Glass cannon |
| **Skald** | Wand / Robe | 1 projectile, very long range, slow | Support caster |
| **Huntsman** | Bow / Light | 1 projectile, fastest fire rate, long range | Rapid archer |

- Class-specific projectile speed, lifetime, tint, size, and damage multipliers
- Class-specific base stats, level gains, and stat caps
- Character select screen with full stat previews and lore

### Ability System (Space Bar)
- **3 progressive abilities per class** unlocking at levels 1, 5, and 10
- Each ability has cooldown and MP cost
- Ability types include:
  - **Healing** (Valkyrie, Skald) — restore HP with visual effects
  - **Buffs** (Viking defense, Berserker attack/speed, Skald group buffs)
  - **AoE damage** (Viking Thunderclap, Runemaster Arcane Nova)
  - **Projectile bursts** (Runemaster Rune Barrage, Huntsman Arrow Volley)
  - **Invincibility** (Valkyrie Wings of Valhalla at high tier)
- Visual cooldown display in HUD with ability names, MP costs, and timers
- Locked abilities show lock icon until level requirement met

### Combat
- Object-pooled projectile system (200 player, 500 enemy)
- 7 enemy bullet pattern types: Aimed, Radial, Spiral, Shotgun, Wall, Star, Burst
- Class-specific weapon profiles (projectile count, spread, speed, lifetime, size, tint)
- Damage calculation with defense scaling and damage multipliers
- Floating damage numbers
- Invincibility frames after hit
- Class tint preserved through damage flashes

### Enemies
- Chunk-based spawning within render distance
- AI state machine: wander when idle, chase and attack on aggro
- Stats scale with biome difficulty (level 1-20)
- Health bars on damaged enemies
- Despawn when out of range

### Dungeons (Nine Realms)
- 4 dungeons: Frostheim Caverns, Verdant Hollows, Muspelheim Forge, Helheim Sanctum
- BSP-style procedural room generation (linear connected rooms)
- Multi-phase boss fights with Norse dialogue and escalating patterns
- Boss-specific loot tables with rare drops
- Boss health bar UI overlay
- Room clearing mechanics with enemy spawning
- Dungeon portals drop from enemy kills (biome-based chance)
- Exit portal spawns on boss defeat

### Asgard Hub (Nexus)
- Safe zone with no enemies or damage
- Handcrafted golden-tile map with rooms
- Vault Keeper NPC: store items that survive death (localStorage)
- Shop Keeper NPC: buy basic gear with gold
- Bifrost Portal: enter Midgard overworld
- Full player state preserved between hub and overworld (HP, MP, XP, gold, class)
- R key to return from overworld at any time

### Progression
- XP and leveling (1-20) with class-specific stat gains per level
- Full heal on level up with visual effect
- HP and MP regeneration (scales with Vitality and Wisdom)
- Permadeath: death is permanent, character is lost
- Fame system: earn fame based on level, kills, dungeons, biomes explored
- Graveyard: view history of fallen characters with fame breakdown
- Vault items survive death

### Inventory & Equipment (RotMG-style)
- 4 equipment slots: Weapon, Ability, Armor, Ring
- 8 inventory bag slots with item stacking
- Class-specific starting gear (proper weapon/armor types per class)
- 40+ items: swords, staves, bows, axes, spears, wands, heavy/medium/light/robe armor, rings, abilities, consumables, 8 rune stones
- Inventory panel shows item names, slot numbers, and usage hints
- "Walk over loot bags to pick up items" instruction in inventory

### Loot System
- Colored loot bags by rarity (Brown, Purple, Cyan, White, Orange)
- Loot tables per difficulty tier (low, mid, high, godlands)
- Boss-specific loot tables with guaranteed rare drops
- Bags despawn after 30 seconds
- Auto-pickup on walk-over

### Quests
- 3 main story quests with Norse narrative (Grima the Seeress questline)
- 5 side quests from various NPCs
- Objective types: kill, collect, reach level, reach biome, equip item
- Auto-tracking with quest completion rewards (XP, gold, items)

### World Map (M key)
- Full-screen overlay showing the concentric biome rings of Midgard
- Player position marker (white dot with pulsing glow)
- Enemy positions shown as red dots
- Dungeon portal markers
- Compass directions (N, S, E, W)
- Biome labels on each ring
- Color-coded legend

### UI (Stardew Valley aesthetic)
- Warm earth-tone palette: wooden panel borders, parchment interiors
- HP/MP/XP bars in top-left panel with increased readability
- Equipment hotbar (bottom center)
- Ability cooldown display (3 slots above hotbar) with names, MP costs, cooldown timers
- Quest tracker (top right, always visible)
- Full inventory panel (I key) with equipment, bag grid, item names, and slot numbers
- Quest journal (J key) with objectives and rewards
- World map overlay (M key) with biome visualization
- Notification toasts with semi-transparent backgrounds and extended duration
- All text uses stroke outlines for readability on any background
- Circular minimap with biome rings and portal markers
- Death screen with fame breakdown and graveyard
- Character select screen with class previews and stat bars
- Controls hint in top-left corner

## Norse Mythology Mapping

| Game Concept | Norse Equivalent |
|---|---|
| Safe Hub | Asgard (Nexus) |
| Overworld | Midgard (256x256 procedural realm) |
| Starter zone | Frozen Shores |
| Mid zone | Birch Forest |
| Hard zone | Volcanic Wastes / Muspelheim Border |
| Core zone | Niflheim Depths |
| Dungeons | Frostheim, Verdant Hollows, Muspelheim Forge, Helheim |
| Stat potions | Rune Stones (8 types, named after Elder Futhark runes) |
| HP potion | Mead Flask |
| MP potion | Seidr Tonic |
| Fame | Earned on death, permanent progress |
| Vault | Death-safe item storage in Asgard |

## Game Flow

1. **Lore Crawl** -> Norse mythology intro (skip with any key)
2. **Character Select** -> Choose from 6 classes with unique combat styles
3. **Midgard Overworld** -> Kill enemies, gain XP, find loot, unlock abilities
4. **Dungeon Portals** -> Drop from killed enemies, walk in to enter
5. **Dungeon** -> Fight through rooms, defeat multi-phase boss, get rare loot
6. **Asgard Hub** -> Press R to return, visit vault/shop NPCs
7. **Death** -> Permadeath! Earn fame, start a new character
8. **Repeat** -> New class, chase rare loot, fill graveyard

## Tech Stack

- **Phaser 3** (v3.87) - 2D game framework with Arcade physics
- **TypeScript** - Strict mode, shared types across packages
- **Vite** - Fast dev server and build tool
- **npm workspaces** - Monorepo for client/server/shared
- **localStorage** - Vault and fame persistence

## Roadmap

- **Phase 4**: AI content generation pipeline (Fastify + Redis + Claude API)
- **Phase 7**: Polish, audio, particles, screen shake, tooltips
- **Phase 8**: Multiplayer via WebSockets

## License

Private - Space City Studios
