# Yggdrasil: Master Game Plan

> A 2D browser + mobile MMORPG bullet-hell RPG. Casual RotMG shooter meets WoW-style dungeoning with Norse mythology, AI-powered content creation, and a creator economy.

**Studio**: Space City Studios
**Last Updated**: February 2026

---

## Table of Contents

1. [Vision & Audience](#1-vision--audience)
2. [Core Game Loop](#2-core-game-loop)
3. [Class System](#3-class-system)
4. [World & Biome Design](#4-world--biome-design)
5. [Dungeon System ("Rune Keys")](#5-dungeon-system-rune-keys)
6. [Progression Systems](#6-progression-systems)
7. [PvP Modes](#7-pvp-modes)
8. [AI-Powered Creator Economy](#8-ai-powered-creator-economy)
9. [Monetization Strategy](#9-monetization-strategy)
10. [Mobile & Cross-Platform](#10-mobile--cross-platform)
11. [Backend Architecture](#11-backend-architecture)
12. [Anti-Cheat](#12-anti-cheat)
13. [Retention & Social Systems](#13-retention--social-systems)
14. [Beta Launch Strategy](#14-beta-launch-strategy)
15. [Development Phases](#15-development-phases)
16. [Tech Stack Summary](#16-tech-stack-summary)

---

## 1. Vision & Audience

### The Elevator Pitch

Yggdrasil is a free-to-play 2D bullet-hell MMORPG set in Norse mythology. Think Realm of the Mad God's fast-paced permadeath combat merged with World of Warcraft's dungeon progression, playable on both web browsers and mobile devices. Players can use AI tools to create and sell their own content — dungeons, skins, items, and quests.

### Two Audiences, One Game

| Player Type | What They Want | Session Length | How We Serve Them |
|---|---|---|---|
| **Casual** (mobile-first) | Quick fun, steady progression, no pressure | 5-15 min | Quick dungeon matchmaking, auto-aim toggle, daily quests, overworld shooting |
| **Mid/Hardcore** (desktop-first) | Deep progression, challenge, competition | 30 min - 2+ hrs | Rune Key scaling (+1 to +20), leaderboards, stat maxing, guild raids, PvP |

**Key design principle**: Same content, different difficulty scales. Casuals clear a base dungeon in 5 minutes. Hardcore players push Rune Key +20 with Norse curse affixes on the same dungeon.

### The 5-Minute Casual Session (Mobile)

1. Open game, character in Asgard hub (10 sec)
2. Tap "Quick Dungeon" matchmaking portal (15 sec)
3. Clear 3-5 procedural rooms (3 min)
4. Boss fight (1 min)
5. Collect loot, return to Asgard (30 sec)
6. **Result**: XP gained, 1-3 items, possibly a Rune Stone. Meaningful progress.

### The 2-Hour Hardcore Session (Desktop)

1. Check marketplace, optimize gear (10 min)
2. Run 3-4 endgame dungeons with guild (45 min)
3. Farm specific dungeon for rare white bag (30 min)
4. Attempt a Ragnarok Rift (infinite scaling difficulty) (20 min)
5. PvP arena or guild event (15 min)
6. **Result**: Rare items, stat progression, leaderboard ranking, guild contribution.

---

## 2. Core Game Loop

```
Create Character → Pick Class + Name
       ↓
   Asgard Hub → Shops, Vault, Quest NPCs, Realm Portal, Quick Dungeon
       ↓
  Enter Midgard → 256x256 procedural world, concentric difficulty zones
       ↓
  Kill Enemies → Bullet-hell combat, dodge patterns, gain XP + loot
       ↓
  Level to 20 → (~30 min) Base stat gains stop
       ↓
 Farm Rune Stones → Max 8 stats to class cap ("8/8" endgame)
       ↓
 Enter Dungeons → Portal drops from killed enemies → Boss + guaranteed loot
       ↓
  Push Rune Keys → Scaling difficulty (+1 to +20) with Norse curse affixes
       ↓
   Permadeath → Die = lose character + gear, keep vault + account fame
       ↓
    Repeat → New class, farm rare UT items, fill collection log, push leaderboard
```

**Every session produces progress**. Even a "failed" run earns XP, items, collection log entries, achievement progress, and battle pass XP. Death stings but never feels wasted.

---

## 3. Class System

### 6 Starter Classes

| Class | Weapon | Ability | Armor | Role | Playstyle |
|---|---|---|---|---|---|
| **Viking** | Sword | Shield Bash (stun) | Heavy | Melee Tank | High defense, close-range |
| **Runemaster** | Staff | Rune Spell (AoE) | Robe | Ranged DPS | High damage, glass cannon |
| **Valkyrie** | Spear | Wings of Valhalla (dash) | Medium | Hybrid | Mobility + medium damage |
| **Berserker** | Axe | Berserker Rage (damage buff) | Light | Glass Cannon | Massive burst, low defense |
| **Skald** | Wand | War Chant (group buff) | Robe | Support | Buffs allies, moderate damage |
| **Huntsman** | Bow | Wolf Companion (summon) | Light | Ranged DPS | Safe range, pet tanking |

### 12 Advanced Classes (unlock at level 20 with specific class + fame)

Unlocked through the class tree system. Examples:
- Viking + Runemaster mastery → **Einherjar** (melee + rune hybrid)
- Valkyrie + Skald mastery → **Shield Maiden** (tank support)
- Berserker + Huntsman mastery → **Ulfhednar** (wolf berserker)

### Stat Caps (per class)

Each class has unique stat caps for the 8 stats. Maxing all 8 via Rune Stones is the "8/8" endgame grind.

| Stat | Viking | Runemaster | Valkyrie | Berserker | Skald | Huntsman |
|---|---|---|---|---|---|---|
| Life | 770 | 585 | 670 | 620 | 600 | 620 |
| Mana | 252 | 385 | 285 | 252 | 385 | 252 |
| Attack | 50 | 60 | 50 | 75 | 55 | 50 |
| Defense | 40 | 25 | 30 | 25 | 25 | 25 |
| Speed | 50 | 60 | 75 | 60 | 55 | 65 |
| Dexterity | 50 | 75 | 50 | 50 | 60 | 75 |
| Vitality | 75 | 40 | 60 | 50 | 45 | 40 |
| Wisdom | 50 | 75 | 50 | 50 | 75 | 50 |

---

## 4. World & Biome Design

### Midgard Overworld (256x256 tiles)

Concentric difficulty zones radiating inward:

```
 ┌──────────────────────────────────────────┐
 │         Frozen Shores (Easy, 1-3)        │
 │    ┌───────────────────────────────┐     │
 │    │     Birch Forest (Mid, 3-5)   │     │
 │    │   ┌───────────────────────┐   │     │
 │    │   │ Volcanic Wastes (5-8) │   │     │
 │    │   │  ┌────────────────┐   │   │     │
 │    │   │  │Niflheim (8-10) │   │   │     │
 │    │   │  │   (Godlands)   │   │   │     │
 │    │   │  └────────────────┘   │   │     │
 │    │   └───────────────────────┘   │     │
 │    └───────────────────────────────┘     │
 └──────────────────────────────────────────┘
```

### Norse Realm Mapping

| Biome | RotMG Equivalent | Difficulty | Enemies | Dungeon Portals |
|---|---|---|---|---|
| Frozen Shores | Beach | 1-3 | Draugr, Ice Wolves, Frost Sprites | Frostheim Caverns |
| Birch Forest | Midlands | 3-5 | Trolls, Dark Elves, Forest Spirits | Verdant Hollows |
| Volcanic Wastes | Highlands | 5-8 | Fire Giants, Lava Drakes, Einherjar | Muspelheim Forge |
| Niflheim Depths | Godlands | 8-10 | Hel's Servants, Frost Wyrms, Valkyries | Helheim Sanctum |

---

## 5. Dungeon System ("Rune Keys")

Hybrid of RotMG portals + WoW Mythic+ affixes + Diablo Greater Rift scaling.

### Entry Methods

| Method | For | How |
|---|---|---|
| **Quick Dungeon** | Casuals | One-tap matchmaking from Asgard hub. 5-8 min, base difficulty. |
| **Overworld Portal** | All | Enemies drop dungeon portals on death. Walk in within 30 sec. |
| **Rune Key** | Hardcore | Use a Rune Key from inventory to open a scaled dungeon (+1 to +20). |

### 5 Core Dungeons (each linked to a Norse realm)

| Dungeon | Source Biome | Length | Boss | Theme |
|---|---|---|---|---|
| **Frostheim Caverns** | Frozen Shores | 5 min | Hrimthursar (Frost Giant) | Ice caves, sliding traps |
| **Verdant Hollows** | Birch Forest | 8 min | Nidhogg's Spawn (Root Wyrm) | Twisted forest, poison |
| **Muspelheim Forge** | Volcanic Wastes | 12 min | Surtr's Lieutenant | Lava rooms, fire walls |
| **Helheim Sanctum** | Niflheim | 15 min | Hel, Daughter of Loki | Undead waves, soul drain |
| **Asgard's Trial** | Rare world boss | 20 min | Fenrir Unbound | Multi-phase, all elements |

### Rune Key Difficulty Scaling

Each Rune Key level adds:
- Enemy HP: +10% per tier
- Enemy damage: +8% per tier
- Enemy speed: +3% per tier
- New bullet patterns at tiers 5, 10, 15, 20

### Runic Curses (Norse Affixes)

| Key Level | Curses | Examples |
|---|---|---|
| +3 | 1 curse | **Fenrir's Hunger**: Enemies heal 5% max HP every 10 sec |
| +7 | 2 curses | **Jormungandr's Venom**: Poison pools spawn under players |
| +10 | 3 curses | **Surtr's Flame**: Fire walls sweep rooms on a timer |
| +14 | Seasonal | **Loki's Trickery**: Enemy patterns shift mid-fight |

More curses:
- **Hel's Grasp**: HP regen disabled, only potions heal
- **Odin's Test**: Timer — complete dungeon or fail
- **Fimbulwinter's Grip**: Periodic frost waves slow all players
- **Berserker Fury**: Boss attacks 30% faster, 30% more HP

### Dungeon Room Types

- **Combat rooms**: Enemy waves. Doors lock until clear.
- **Treasure rooms**: Loot chests guarded by traps.
- **Trap corridors**: Projectile hazards testing dodge skill.
- **Mini-boss rooms**: Halfway checkpoint with sub-boss.
- **Boss arena**: Large open room, multi-phase bullet patterns.

### Loot

- Bosses guarantee a loot bag. Rarity scales with Rune Key level.
- Soulbound threshold: Must deal 15% of boss HP to qualify for rare drops.
- Dungeon-exclusive untiered (UT) items create "white bag" chase items.

---

## 6. Progression Systems

### Layer 1: Level 1-20 (30 min)

Standard XP from kills. Stat gains per level. Fast to reach cap — this is the casual-accessible layer.

### Layer 2: Rune Stones ("8/8")

8 stat potions, one per stat. Drop from mid-high difficulty enemies and dungeon bosses. Consuming one permanently raises that stat toward the class cap. Maxing all 8 = "8/8" character.

### Layer 3: Fame (Account-Wide, Survives Permadeath)

Fame is earned when a character dies, based on:
- Character level and stats
- Enemies killed
- Dungeons completed
- Quests completed
- Time alive
- Special bonuses (no deaths before level 10, first 8/8, etc.)

Fame unlocks: character slots, vault slots, class unlocks, cosmetic titles.

### Layer 4: Collection Log ("Tome of Yggdrasil")

Account-wide log of every unique item, enemy, and dungeon ever encountered. Survives permadeath. Completing a dungeon's full collection unlocks cosmetic rewards.

Categories:
- Items obtained (grouped by source)
- Enemies slain (every type, with kill count)
- Dungeons completed (with fastest time)
- Classes maxed (all stats capped)
- Rune Stones consumed (lifetime total)
- Deaths recorded (with timestamp, level, biome, cause)

### Layer 5: Achievements ("Sagas")

Norse-themed achievement system. Tiered (Bronze/Silver/Gold/Legendary). Account-wide.

- **Combat Sagas**: Kill counts, boss kills, damage records
- **Explorer Sagas**: Visit all biomes, discover all dungeons
- **Collector Sagas**: Obtain all items of a type
- **Death Sagas**: Die in specific ways (makes permadeath feel less punishing)
- **Class Sagas**: Max all stats on each class

Cumulative "Saga Score" displayed on profile and leaderboard.

### Layer 6: Season Battle Pass ("Saga Pass")

6-week seasons. Free and premium tracks. Details in Monetization section.

---

## 7. PvP Modes

### Phase 1: Arena Duels

- 1v1 arenas in Asgard hub
- Equalized stats option for fair matches
- Ranked ladder with seasonal rewards

### Phase 2: Battlegrounds

- 5v5 "Einherjar's Arena" — team deathmatch
- 10v10 "Ragnarok Fields" — objective-based (capture relics)
- Matchmade with skill-based rating

### Phase 3: Open-World PvP Zones

- Designated PvP zones in the overworld (e.g., "Valhalla's Edge")
- Full-loot PvP in these zones only (high risk, high reward)
- Guild territory control in PvP zones

### Phase 4: Guild Wars

- Guild vs Guild structured warfare
- Territory siege: Attack/defend guild halls
- Seasonal guild rankings with cosmetic trophies

### Phase 5: Dungeon PvP ("Loki's Gambit")

- Special PvP dungeon mode: race through the same dungeon
- First team to defeat the boss wins bonus loot
- Sabotage mechanics: trigger traps in the other team's path

---

## 8. AI-Powered Creator Economy

### The "Dungeon Forge"

Players use AI tools to create game content, which can be shared or sold.

### What Players Can Create

| Content Type | AI Assists With | Monetizable? |
|---|---|---|
| **Dungeon Layouts** | Room generation, trap placement, enemy scaling | Yes — sell templates |
| **Cosmetic Skins** | Text-to-pixel-art (16x16/32x32) for weapons/armor | Yes — marketplace |
| **Enemy Designs** | Behavior patterns, bullet patterns, sprite generation | Yes — for dungeons |
| **Quest Storylines** | Lore text, objectives, dialogue, reward scaling | Yes — lore packs |
| **Map Biomes** | Noise parameters, tile rules, colors, hazards | Yes — realm expansions |

### Creation Flow

1. Player opens "Dungeon Forge" editor
2. Describes their vision (text prompt + parameter selection)
3. AI generates content respecting game schemas and balance constraints
4. Automated validation: sprite dimensions, color palette, stat ranges, NSFW detection
5. Player previews and iterates
6. Publishes to Workshop or personal use

### Moderation Pipeline

```
Submission → Auto-Check → Community Review → Staff Approval → Live

Auto-Check (instant): File format, palette compliance, stat ranges, NSFW detection, profanity filter
Community Review (24-48h): Workshop Preview, upvote/downvote, 50+ votes with >70% positive
Staff Approval: Manual review for Featured items only
Live: Ongoing monitoring, auto-pull if >20% flag rate
```

### Creator Revenue Model

| Model | Details | Recommended? |
|---|---|---|
| **Creation Credits** (per-use) | 100 credits for $4.99. Each generation costs 5-20 credits. | Yes — primary |
| **Creator Pass** (subscription) | $7.99/month. Unlimited generations + marketplace perks. | Yes — for power creators |
| **Creator Marketplace** (rev share) | Creators sell content. 70% creator / 30% platform. | Yes — long-term |
| **Free Tier** | 3 free AI generations per day. | Yes — funnel |

### Balance Protection

- All marketplace items are **cosmetic only** (no stat advantages)
- If items have stats, they must fall within predefined tier ranges
- Separate "Creative" realm from competitive realm
- Creator items are soulbound (no re-trading)

---

## 9. Monetization Strategy

### Revenue Streams

| Stream | Description | Price Point |
|---|---|---|
| **Saga Pass** (Battle Pass) | 40 levels, 6-week seasons. Free + premium tracks. | $9.99/season |
| **Odin's Favor** (Subscription) | +2 vault slots, +1 char slot, daily Rune Stone, cosmetic hub, 50 premium currency/day | $4.99/month |
| **Cosmetic Shop** | Character skins, weapon skins, pet skins, gravestones, dye system, emotes | $0.99-$19.99 |
| **Creator Credits** | AI generation credits for the Dungeon Forge | $4.99/100 credits |
| **Creator Pass** | Unlimited AI generations + marketplace benefits | $7.99/month |
| **Rewarded Ads** | 2 touchpoints only (post-dungeon loot bonus, post-death revival) | Free/ad-supported |

### Saga Pass Details

- **Free track**: Consumables, Rune Stones, low-tier gear, 1-2 cosmetics
- **Premium track ($9.99)**: Exclusive Norse character skins, pet skins, vault slots, 150 premium currency
- **Key rule**: Premium track includes enough currency to buy the next season's pass (creates incredible retention)
- **XP sources**: Daily quests, weekly challenges, dungeon clears, boss kills, PvP wins

### Odin's Favor Subscription ($4.99/month)

- +2 vault slots (killer feature for permadeath game)
- +1 character slot
- Daily random Rune Stone
- Exclusive Asgard hub variant (cosmetic)
- Premium chat color
- 50 premium currency per day
- **No combat power advantages**

### Cosmetic Ideas (Norse Goldmine)

- Seasonal sets: Valkyrie armor, Draugr skin, Einherjar golden skin, Jotun frost skin
- Custom gravestones (Viking ship burial, Runestone, Pyre) — premium flex in permadeath
- Weapon skins that change projectile visuals (fire trails, ice crystals) — visual only
- Character dye system using Norse color palettes

### Rewarded Ads (2 Touchpoints Only)

1. **"Offering to the Norns"**: After dungeon completion, watch ad for bonus loot roll
2. **"Hel's Bargain"**: After death, watch ad to resurrect with 50% HP (once per day)

**Never**: Interstitial ads, banner ads, forced ads of any kind.

### What We NEVER Sell

- Rune Stones for real money (destroys the economy)
- Gear with stats for real money (pay-to-win)
- XP or damage multipliers
- Gacha/loot boxes with gameplay items
- Energy/stamina systems gating core gameplay

---

## 10. Mobile & Cross-Platform

### Strategy: Phaser Web Client + Capacitor Native Wrapper

The game is already web-based (Phaser). This gives us:
- **Web browser**: Instant play, zero download barrier, desktop + mobile browsers
- **iOS/Android apps**: Wrap with Capacitor for App Store/Play Store presence
- **Same codebase**: Single TypeScript client for all platforms
- **Cross-play**: Same servers, same characters, same world

### Mobile Control Scheme

```
┌─────────────────────────────────────────────┐
│                                             │
│   [HP] [MP]        [Minimap]                │
│                                             │
│                                             │
│                                             │
│                                             │
│        (Game World - tap right              │
│         half to aim/shoot)                  │
│                                             │
│                                             │
│   ┌─────┐                      [Ability]    │
│   │Joystick│                   [Potion]     │
│   │(move) │                                 │
│   └─────┘                                   │
└─────────────────────────────────────────────┘

Left thumb: Virtual joystick (movement, dodging)
Right half: Tap to aim and shoot toward that point
Ability button: Spacebar equivalent
Auto-aim toggle: For casual play, auto-targets nearest enemy
```

### UI Adaptation

| Element | Desktop | Mobile |
|---|---|---|
| Minimap | Bottom-left, 55px | Top-right, smaller |
| HP/MP bars | Top-left panel | Top-left, enlarged |
| Inventory | 8 slots visible | 3 quick-use slots, full on tap |
| Chat | Always visible | Hidden, tap to open |
| Quest tracker | Top-right | Collapsed, tap to expand |

### Session-Length Content Design

| Duration | Activity | Platform |
|---|---|---|
| 2-5 min | Daily login, quick PvP match, sell items | Mobile micro-session |
| 5-15 min | One dungeon, daily quests, overworld farming | Mobile session |
| 30-60 min | Multiple dungeons, guild activities, marketplace | Desktop session |
| 2+ hrs | Endgame progression, raids, PvP tournaments | Desktop deep session |

### Performance Optimization for Mobile

- Reduce particle effects on mobile
- Lower projectile render count (pool smaller on mobile)
- Simplify tile rendering for distant chunks
- Target 60fps on mid-range devices (2022+ phones)

---

## 11. Backend Architecture

### Server Architecture: Hub and Spoke

```
                    ┌─────────────────┐
                    │   Login/Auth    │
                    │     Server      │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
       ┌──────┴──────┐ ┌────┴──────┐ ┌────┴──────┐
       │  Realm #1   │ │ Realm #2  │ │ Realm #3  │
       │ (50-100     │ │           │ │           │
       │  players)   │ │           │ │           │
       └──────┬──────┘ └───────────┘ └───────────┘
              │
    ┌─────────┼─────────┐
    │         │         │
┌───┴───┐ ┌──┴────┐ ┌──┴────┐
│Dungeon│ │Dungeon│ │Dungeon│    (ephemeral instances)
│  #1   │ │  #2   │ │  #3   │
└───────┘ └───────┘ └───────┘
```

### Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Runtime | Node.js (TypeScript) | Same language as client, shared types |
| Framework | Colyseus (to start) | Room-based multiplayer, built-in state sync |
| Protocol | WebSocket + MessagePack | Binary for performance, browser-compatible |
| Primary DB | PostgreSQL | ACID for permadeath transactions |
| Cache/Sessions | Redis | Real-time state, pub/sub, sessions |
| Auth | Google + Apple + Discord OAuth + Guest | Maximum reach |
| Hosting | Single dedicated server (beta) | ~$45/month for 500 concurrent |
| CDN | Cloudflare (free tier) | Asset serving |
| Monitoring | Grafana + Prometheus | Tick time, player count, errors |
| Error Tracking | Sentry (free tier) | Client + server errors |
| Analytics | PostHog (self-hosted) | Retention, funnels, events |

### Database Schema (Key Tables)

- **accounts**: UUID, email, display_name, account_fame, vault_slots, char_slots, total_deaths, auth_provider
- **characters**: UUID, account_id, class_name, level, xp, fame, 8 stats, 4 equipment slots, inventory[], is_alive, death_cause
- **vault_items**: Account-level persistent storage (survives permadeath)
- **items**: Instance tracking with rolled stat bonuses
- **death_log**: Archived characters for graveyard/fame history

### Permadeath Transaction (Atomic)

Character death MUST be a database transaction:
1. Load character (FOR UPDATE lock)
2. Calculate fame earned
3. Archive death to death_log
4. Add fame to account
5. Mark character dead
6. Destroy equipped + inventory items

### Save Strategy

- **Redis**: Real-time hot state (position, HP/MP, buffs) — updated every tick
- **PostgreSQL checkpoint**: Every 30-60 seconds batch write
- **Immediate write**: Item acquisition, character death, vault deposits
- **Crash recovery**: Max 60 sec of XP/position loss, never item loss

### Guest Account Flow (Zero Friction)

1. Player visits game → client generates UUID
2. Server creates guest account → plays immediately
3. After first death or rare item: "Save your progress!" prompt
4. Player links Google/Apple/Discord → seamless upgrade
5. Same vault, same fame, same everything

### Server Capacity

| Component | Capacity | Notes |
|---|---|---|
| Single Realm | 50-100 players | One 256x256 world |
| Single Dungeon | 1-6 players | Ephemeral instance |
| Single Machine | 5-10 Realms + 50 Dungeons | ~1000 concurrent |
| Beta Launch | 1 machine | 200-500 concurrent |

---

## 12. Anti-Cheat

### Server-Authoritative (Non-Negotiable)

The Phaser client is a **view layer only**. It sends inputs and renders responses.

| System | Server Controls | Client Does |
|---|---|---|
| Movement | Validates position, enforces speed | Sends WASD input, renders interpolated position |
| Combat | Calculates damage, validates hits | Sends "fire at angle X", renders projectile visuals |
| Loot | Determines drops, assigns ownership | Displays bags, sends pickup requests |
| HP/MP | Tracks all changes | Displays HP bar, sends ability use requests |
| Inventory | Manages all operations | Displays UI, sends swap/use requests |

### Key Protections

- **Speed validation**: Server rejects movement exceeding max speed + 15% tolerance
- **Fire rate validation**: Server enforces cooldowns based on server-side dex stat
- **Damage calculation**: Server-side only, using server-authoritative stats
- **Item duplication prevention**: PostgreSQL transactions with row-level locks
- **Rate limiting**: Token bucket per player per action type
- **Packet sequencing**: Reject out-of-order or duplicate packets
- **Multi-box prevention**: 1 active WebSocket per account

---

## 13. Retention & Social Systems

### Guilds ("Warbands")

The #1 long-term retention mechanism. Players in active guilds are 5-10x more likely to be playing 6 months later.

- Shared clan vault
- Clan hall in Asgard (decoratable)
- Weekly clan challenges with ranked rewards
- Clan leaderboard (total fame earned by all members)
- Clan ranks and permissions
- Clan chat channel
- Small XP/fame bonus for playing with clanmates

### Leaderboards ("Saga Leaderboard")

Multiple categories so more players can compete:
- Total Fame (all-time)
- Season Fame
- Highest Rune Key Cleared (per class)
- Longest-Lived Character
- Most Dungeons Cleared (per season)
- Fastest Dungeon Clear (speedrun per dungeon)

Top 3 players displayed visually in Asgard hub.

### Daily Login ("Odin's Rune")

28-day cumulative calendar (not consecutive — missing days doesn't reset):
- Days 1-7: Consumables
- Days 8-14: Rune Stones
- Day 21: Cosmetic item
- Day 28: Character slot or major cosmetic

### Seasonal Events (4-6 per year)

| Season | Event | Theme |
|---|---|---|
| Dec-Jan | **Yule / Fimbulwinter** | Ice dungeon, Yule Log boss, frost cosmetics |
| Mar-Apr | **Ostara** | Spring rebirth, Alfheim dungeon, nature theme |
| Jun-Jul | **Midsommar** | Festival of light, PvP tournament, guild competitions |
| Sep-Oct | **Haustblot** | Harvest/death, Helheim dungeon, draugr cosmetics |
| Anniversary | **Ragnarok** | Surtr raids, world tree under attack, all-realm event |

### Collection Log + Achievements + Season Pass

Combined, these three systems ensure there's ALWAYS something to work toward, regardless of player type or session length.

---

## 14. Beta Launch Strategy

### Phase 1: Friends & Family Alpha (2-4 weeks)

- **Players**: 5-15 (team + trusted friends)
- **Purpose**: Game-breaking bugs, core loop validation
- **Infrastructure**: Single server, single realm, 2-3 dungeon types
- **Key questions**: Does permadeath feel fair? Is loot satisfying? Do controls feel good?

### Phase 2: Closed Beta (4-8 weeks)

- **Players**: 50-200 (invite-only via keys)
- **Purpose**: Server scalability, social dynamics, economy balance, retention
- **Infrastructure**: 2-3 realm servers, full dungeon pool, database backups
- **Recruitment**: Discord community, r/indiegaming, r/rotmg, r/MMORPG, Twitter/X, itch.io

### Phase 3: Open Beta (4-8 weeks)

- **Players**: 500-2000+
- **Purpose**: Stress test, content pacing, monetization testing
- **Infrastructure**: Auto-scaling realms, monitoring stack, geographic regions

### Key Metrics to Track

| Metric | Target | What It Tells You |
|---|---|---|
| D1 Retention | >40% | Is the first session compelling? |
| D7 Retention | >15% | Is there enough content? |
| Avg session length | >20 min | Is the core loop engaging? |
| Avg character lifespan | 15-45 min | Is permadeath tuned right? |
| Deaths per session | 1-3 | Stings but doesn't rage-quit |
| Dungeon completion rate | 60-80% | Difficulty calibration |
| Class distribution | Even-ish | Balance indicator |

### Beta Launch Checklist

- [ ] Server monitoring (CPU, memory, tick time)
- [ ] Automated database backups (every 6 hours)
- [ ] Error tracking (Sentry)
- [ ] Graceful shutdown (save all player state)
- [ ] Admin tools (kick, ban, grant items)
- [ ] Landing page with beta signup
- [ ] Discord server with structured channels
- [ ] In-game `/feedback` command piped to Discord webhook

---

## 15. Development Phases

### Phase 4: Dungeon System (CURRENT PRIORITY — Highest Impact)

1. Implement DungeonManager using BSP/noise room generation
2. Add dungeon portal drops to EnemyManager (biome-based)
3. Create 5 base dungeon types (Frostheim, Verdant, Muspelheim, Helheim, Asgard's Trial)
4. Implement boss fights using all BulletPatternTypes (Spiral, Wall, Star, Burst)
5. Multi-phase bosses with health thresholds and pattern changes
6. Rune Key scaling system (+1 to +20)
7. Runic Curse affixes (8 curses)
8. "Quick Run" matchmaking from Asgard hub
9. Soulbound loot qualification tracking

### Phase 5: Asgard Hub + Class System

1. NexusScene (Asgard): handcrafted safe zone with NPC shops, vault, quest givers, portals
2. 6 starter classes with unique weapons and abilities
3. StatManager: per-class stat caps, Rune Stone consumption, 8/8 tracking
4. CharacterSelectScene with multi-character support
5. Fame system (calculated on death)
6. Vault system (account-level item storage)
7. Nexus hotkey (R) to escape anywhere

### Phase 6: Backend + Multiplayer Foundation

1. Colyseus server with Room-based realm/dungeon instances
2. PostgreSQL schema (accounts, characters, items, vault, death_log)
3. Redis for real-time state and sessions
4. Guest account + OAuth (Google, Apple, Discord)
5. Server-authoritative movement and combat
6. WebSocket + MessagePack binary protocol
7. Client-side prediction for movement

### Phase 7: Mobile + Cross-Platform

1. TouchInputManager (virtual joystick + tap-to-aim)
2. Responsive UI layouts for mobile viewports
3. Auto-aim toggle for casual mobile play
4. Capacitor wrapper for iOS/Android
5. Performance optimization for mobile browsers

### Phase 8: Economy + Social

1. Player-to-player trading (direct + async Trading Post)
2. Guild/Warband system (shared vault, hall, weekly challenges)
3. Chat system (proximity, guild, whisper)
4. Friend list and party system
5. Leaderboards

### Phase 9: Monetization + Retention

1. Saga Pass (battle pass) with free + premium tracks
2. Cosmetic shop
3. Odin's Favor subscription
4. Rewarded ads (2 touchpoints)
5. Daily login calendar
6. Collection Log + Achievement system
7. Seasonal events (first: Yule/Fimbulwinter)

### Phase 10: AI Creator Economy

1. "Dungeon Forge" tile/room editor
2. AI sprite generation (text-to-pixel-art) for cosmetic skins
3. AI enemy design tools (patterns, stats, sprites)
4. AI quest storyline generation
5. Creator Marketplace with 70/30 revenue split
6. Creation Credits monetization
7. Moderation pipeline (auto + community + staff)

### Phase 11: PvP

1. Arena duels (1v1)
2. Battlegrounds (5v5, 10v10)
3. Ranked PvP ladder
4. Open-world PvP zones
5. Guild wars and territory siege
6. Dungeon PvP ("Loki's Gambit")

### Phase 12: Polish + Scale

1. Audio (music + SFX per biome/dungeon)
2. Particles, screen effects, death animations
3. Multi-region server deployment
4. Auto-scaling infrastructure
5. Content expansion via AI (50+ more enemies, 20+ items, 5+ dungeons)
6. Cross-browser and cross-device testing
7. App Store / Play Store submission

---

## 16. Tech Stack Summary

| Layer | Technology |
|---|---|
| **Client** | Phaser 3 + TypeScript + Vite |
| **Mobile Wrapper** | Capacitor (iOS/Android) |
| **Server** | Node.js + Colyseus (TypeScript) |
| **Protocol** | WebSocket + MessagePack |
| **Database** | PostgreSQL (persistent) + Redis (real-time) |
| **Auth** | Guest + Google + Apple + Discord OAuth |
| **AI Generation** | Claude API + custom prompt templates |
| **Content Validation** | Ajv JSON schemas + balance range checkers |
| **Hosting** | Hetzner dedicated ($45/mo for beta) + Cloudflare CDN |
| **Monitoring** | Grafana + Prometheus + Sentry + PostHog |
| **Monorepo** | npm workspaces (client / server / shared) |

---

## Existing Codebase Touchpoints

Key files ready for extension:

| File | Relevance |
|---|---|
| `shared/src/types/game-types.ts` | Already defines `GameState.Dungeon`, all `BulletPatternType` values (Spiral, Wall, Star, Burst), 7 Norse `BiomeType` values, unused enemy behaviors (Orbit, Flee, Boss, Stationary) |
| `client/src/systems/EnemyManager.ts` | Currently uses 3 of 7 bullet patterns. Extending to all patterns creates boss fights. |
| `client/src/systems/WorldRenderer.ts` | SimpleNoise + tile generation reusable for dungeon layout generation |
| `client/src/systems/LootManager.ts` | Tiered loot tables ready for dungeon-exclusive drops |
| `shared/src/constants/balance.ts` | SOULBOUND_THRESHOLD already defined. Dungeon multipliers go here. |
| `client/src/systems/InputManager.ts` | Abstraction layer ready for TouchInputManager implementation |
| `shared/src/constants/biomes.ts` | 4-biome layout maps directly to 4 dungeon difficulty tiers |

---

*This plan is a living document. Update as decisions are made and phases are completed.*
