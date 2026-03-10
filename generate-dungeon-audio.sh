#!/bin/bash
# Generate 4 per-dungeon ambient music tracks via ElevenLabs
# Usage: ELEVENLABS_API_KEY=your_key_here ./generate-dungeon-audio.sh

API_KEY="${ELEVENLABS_API_KEY}"
if [ -z "$API_KEY" ]; then
  echo "Error: Set ELEVENLABS_API_KEY env var before running."
  exit 1
fi

AUDIO_DIR="client/public/assets/audio"
mkdir -p "$AUDIO_DIR"

generate() {
  local key="$1"
  local prompt="$2"
  echo "Generating $key..."
  curl -s -X POST "https://api.elevenlabs.io/v1/sound-generation" \
    -H "xi-api-key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"text\": \"$prompt\", \"duration_seconds\": 45, \"prompt_influence\": 0.3}" \
    --output "$AUDIO_DIR/${key}.mp3"
  local size=$(wc -c < "$AUDIO_DIR/${key}.mp3")
  echo "  -> ${key}.mp3 (${size} bytes)"
}

generate "music_dungeon_frost" \
  "Ambient RPG dungeon music, icy crystalline cave, RuneScape style melodic, haunting wind chimes and sparse piano, cold ethereal minor key, calm and tense, no drums, loops seamlessly"

generate "music_dungeon_verdant" \
  "Ambient RPG dungeon music, dark corrupted underground forest, RuneScape style atmospheric, mysterious woodwind melody, low bass drone, eerie and mystical, minor key, loops seamlessly"

generate "music_dungeon_muspelheim" \
  "Ambient RPG dungeon music, volcanic forge fire realm, RuneScape style intense, rhythmic metallic percussion, deep brass undertones, dramatic and foreboding, heavy atmosphere, loops seamlessly"

generate "music_dungeon_helheim" \
  "Ambient RPG dungeon music, death underworld realm, RuneScape style somber orchestral, slow haunting choir, deep organ tones, very dark and oppressive, ghostly minor key, loops seamlessly"

echo ""
echo "Done! Tracks saved to $AUDIO_DIR/"
ls -lh "$AUDIO_DIR"/music_dungeon_*.mp3 2>/dev/null
