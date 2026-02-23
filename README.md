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
| **I** | Toggle Inventory |
| **J** | Toggle Quest Journal |
| **Space** | Ability (coming soon) |

## Project Structure

```
yggdrasil/
  shared/          # Shared types, enums, constants, balance formulas
  client/          # Phaser 3 game client (Vite + TypeScript)
    src/
      scenes/      # Boot, Preload, Game, UI scenes
      systems/     # PlayerController, EnemyManager, ProjectileManager,
                   # InventoryManager, QuestManager, LootManager, etc.
      data/        # ItemDatabase, QuestDatabase
      utils/       # SpriteGenerator, ObjectPool, MathUtils
  server/          # Content API server (placeholder for Phase 4)
```

## What's Built (Phases 1-3)

### Core Game Loop
- Procedurally generated 256x256 tile world using Perlin noise
- 4 concentric biome zones: Frozen Shores, Birch Forest, Volcanic Wastes, Niflheim Depths
- Difficulty scales as you move toward the center of the world
- WASD movement with mouse-aim shooting
- Pixel-perfect camera follow with 2x zoom

### Combat
- Object-pooled projectile system (200 player, 500 enemy)
- 3 enemy bullet patterns: aimed, radial (8-way), and shotgun (cone)
- Damage calculation with defense scaling
- Floating damage numbers
- Camera shake on hit

### Enemies
- Chunk-based spawning within render distance
- AI state machine: wander when idle, chase and attack on aggro
- Stats scale with biome difficulty (level 1-20)
- Health bars on damaged enemies
- Despawn when out of range

### Progression
- XP and leveling (1-20) with stat gains per level
- Full heal on level up with visual effect
- HP and MP regeneration (scales with Vitality and Wisdom)

### Inventory & Equipment (RotMG-style)
- 4 equipment slots: Weapon, Ability, Armor, Ring
- 8 inventory bag slots with item stacking
- Starting gear: Rusty Blade, Wooden Shield, Leather Hauberk, Iron Band
- 30+ items: swords, staves, bows, axes, armor, rings, abilities, consumables, 8 rune stones

### Loot System
- Colored loot bags by rarity (Brown, Purple, Cyan, White, Orange)
- Loot tables per difficulty tier (low, mid, high, godlands)
- Bags despawn after 30 seconds
- Auto-pickup on walk-over

### Quests
- 3 main story quests with Norse narrative (Grima the Seeress questline)
- 5 side quests from various NPCs
- Objective types: kill, collect, reach level, reach biome, equip item
- Auto-tracking with quest completion rewards (XP, gold, items)

### UI (Stardew Valley aesthetic)
- Warm earth-tone palette: wooden panel borders, parchment interiors
- HP/MP/XP bars in top-left panel
- Equipment hotbar (bottom center)
- Quest tracker (top right, always visible)
- Full inventory panel (I key) with equipment + bag grid
- Quest journal (J key) with objectives and rewards
- Notification toasts for pickups, quest progress, and biome changes
- Death overlay with respawn

## Norse Mythology Mapping

| Game Concept | Norse Equivalent |
|---|---|
| Overworld | Midgard (256x256 procedural realm) |
| Starter zone | Frozen Shores |
| Mid zone | Birch Forest |
| Hard zone | Volcanic Wastes / Muspelheim Border |
| Core zone | Niflheim Depths |
| Stat potions | Rune Stones (8 types, named after Elder Futhark runes) |
| HP potion | Mead Flask |
| MP potion | Seidr Tonic |

## Tech Stack

- **Phaser 3** (v3.87) - 2D game framework with Arcade physics
- **TypeScript** - Strict mode, shared types across packages
- **Vite** - Fast dev server and build tool
- **npm workspaces** - Monorepo for client/server/shared

## Roadmap

- **Phase 4**: AI content generation pipeline (Fastify + Redis + Claude API)
- **Phase 5**: Dungeons (Nine Realms) and Asgard hub
- **Phase 6**: 6 starter classes with unique abilities
- **Phase 7**: Polish, audio, minimap, particles
- **Phase 8**: Multiplayer via WebSockets

## License

Private - Space City Studios
