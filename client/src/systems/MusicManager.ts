/**
 * MusicManager: Handles background music and sound effects.
 *
 * Tracks:
 *   music_overworld — calm Norse ambient for overworld exploration
 *   music_dungeon   — tense atmospheric for dungeon exploration
 *   music_boss      — epic drums for boss fights
 *
 * SFX (lower volume than music):
 *   sfx_ability     — special ability activation
 *   sfx_hit_enemy   — enemy takes a hit
 *   sfx_player_hit  — player takes damage
 *   sfx_heal        — instant heal pickup
 *   sfx_level_up    — player levels up
 *   sfx_portal      — entering a portal
 */

export class MusicManager {
  private scene: Phaser.Scene;
  private currentTrack: Phaser.Sound.BaseSound | null = null;
  private currentTrackKey: string = '';

  // Volume settings
  private readonly MUSIC_VOLUME = 0.10;   // RuneScape-level ambient background
  private readonly SFX_VOLUME = 0.40;     // clear but not jarring

  // SFX cooldowns to prevent spamming
  private sfxCooldowns: Map<string, number> = new Map();
  private readonly SFX_COOLDOWN_MS: Record<string, number> = {
    sfx_hit_enemy: 80,
    sfx_player_hit: 200,
    sfx_ability: 100,
    sfx_heal: 200,
    sfx_level_up: 0,
    sfx_portal: 0,
  };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Play a music track. If already playing the same track, do nothing. */
  playMusic(key: string): void {
    if (this.currentTrackKey === key && this.currentTrack?.isPlaying) return;

    if (this.currentTrack) {
      this.scene.tweens.add({
        targets: this.currentTrack,
        volume: 0,
        duration: 800,
        onComplete: () => {
          this.currentTrack?.stop();
          this.startTrack(key);
        },
      });
    } else {
      this.startTrack(key);
    }
  }

  private startTrack(key: string): void {
    if (!this.scene.cache.audio.has(key)) return;

    this.currentTrack = this.scene.sound.add(key, {
      volume: 0,
      loop: true,
    });
    this.currentTrack.play();
    this.currentTrackKey = key;

    // Fade in
    this.scene.tweens.add({
      targets: this.currentTrack,
      volume: this.MUSIC_VOLUME,
      duration: 1200,
    });
  }

  /** Stop music with a fade-out */
  stopMusic(): void {
    if (!this.currentTrack) return;
    this.scene.tweens.add({
      targets: this.currentTrack,
      volume: 0,
      duration: 600,
      onComplete: () => {
        this.currentTrack?.stop();
        this.currentTrack = null;
        this.currentTrackKey = '';
      },
    });
  }

  /** Play a sound effect (with optional cooldown to prevent spam) */
  playSFX(key: string): void {
    if (!this.scene.cache.audio.has(key)) return;

    // Check cooldown
    const now = Date.now();
    const lastPlayed = this.sfxCooldowns.get(key) ?? 0;
    const cooldown = this.SFX_COOLDOWN_MS[key] ?? 100;
    if (now - lastPlayed < cooldown) return;
    this.sfxCooldowns.set(key, now);

    this.scene.sound.play(key, { volume: this.SFX_VOLUME });
  }

  /** Transfer this manager to a new scene (stops old, scene reference updated) */
  migrateToScene(newScene: Phaser.Scene): MusicManager {
    const newMgr = new MusicManager(newScene);
    newMgr.currentTrackKey = this.currentTrackKey;
    // Stop old track — new scene will start its own
    this.currentTrack?.stop();
    this.currentTrack = null;
    this.currentTrackKey = '';
    return newMgr;
  }
}
