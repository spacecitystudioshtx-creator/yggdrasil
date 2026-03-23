#!/bin/bash
# Generate Viking/Norse-themed music for Yggdrasil using ElevenLabs Music API
# Usage: ELEVENLABS_API_KEY=sk_xxx ./scripts/generate-music.sh

set -e

API_KEY="${ELEVENLABS_API_KEY:-sk_4a080f5e01d8a17fdcaf2dd94c15adde13ba6eaf360258e3}"
OUTPUT_DIR="client/public/assets/audio"
API_URL="https://api.elevenlabs.io/v1/music"

echo "=== Yggdrasil Music Generator ==="
echo "Output: $OUTPUT_DIR"

generate_track() {
  local name="$1"
  local prompt="$2"
  local duration="$3"
  local output="$OUTPUT_DIR/$name.mp3"

  echo ""
  echo "--- Generating: $name ($((duration/1000))s) ---"
  echo "Prompt: $prompt"

  local http_code
  http_code=$(curl -s -w "%{http_code}" -o "$output.tmp" \
    -X POST "$API_URL" \
    -H "xi-api-key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"prompt\": $(echo "$prompt" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))'),
      \"music_length_ms\": $duration,
      \"force_instrumental\": true,
      \"output_format\": \"mp3_44100_128\"
    }")

  if [ "$http_code" -eq 200 ] && [ -s "$output.tmp" ]; then
    mv "$output.tmp" "$output"
    echo "SUCCESS: $output ($(du -h "$output" | cut -f1))"
  else
    echo "FAILED (HTTP $http_code)"
    if [ -f "$output.tmp" ]; then
      cat "$output.tmp"
      rm -f "$output.tmp"
    fi
    echo ""
  fi
}

# Overworld: Calm, atmospheric Norse ambient — think RuneScape meets Skyrim
generate_track "music_overworld" \
  "Calm atmospheric Norse Viking ambient music for exploring a vast open world. Gentle strings, soft flutes, distant horns. Medieval Scandinavian folk influences. Peaceful but with an undercurrent of adventure and mystery. Similar to RuneScape overworld music or Skyrim exploration themes. Loopable ambient background." \
  120000

# Generic dungeon: Tense atmospheric exploration
generate_track "music_dungeon" \
  "Dark atmospheric dungeon exploration music. Tense, mysterious, echoing cavern sounds. Deep bass drones, occasional metallic clangs, sparse percussion. Norse mythological atmosphere. Medieval dark ambient. Loopable background music for dungeon crawling." \
  90000

# Boss fight: Epic intense battle
generate_track "music_boss" \
  "Epic intense Norse Viking boss battle music. Thundering war drums, aggressive string section, powerful brass horns. Fast-paced combat rhythm. Dramatic and urgent. Think God of War or Skyrim dragon fight. Heavy percussion, choir-like atmospheric layers. Battle music that gets the blood pumping." \
  90000

# Frostheim: Icy cold dungeon
generate_track "music_dungeon_frost" \
  "Icy cold atmospheric dungeon music. Crystalline chimes, howling wind ambience, sparse piano notes. Frozen cavern exploration. Nordic winter atmosphere. Deep blue coldness. Occasional cracking ice sounds. Minimalist and haunting. Scandinavian folk elements." \
  90000

# Verdant Hollows: Corrupted forest
generate_track "music_dungeon_verdant" \
  "Dark corrupted forest dungeon music. Twisted organic sounds, deep wooden percussion, eerie whispers. Ancient poisoned roots and dark nature. Celtic and Norse folk instruments distorted. Creeping vines and thorns atmosphere. Mysterious and threatening." \
  90000

# Muspelheim: Volcanic fire realm
generate_track "music_dungeon_muspelheim" \
  "Volcanic fire realm dungeon music. Deep rumbling bass, crackling flames, intense heat atmosphere. Hammers on anvils, forge sounds. Norse fire giant realm. Aggressive but steady rhythm. Molten lava and burning metal. Dark industrial medieval forge music." \
  90000

# Helheim: Realm of the dead
generate_track "music_dungeon_helheim" \
  "Dark death realm underworld music. Ghostly whispers, deep resonant bells, haunting choir. Realm of the dead in Norse mythology. Cold, empty, vast echoing spaces. Slow mournful strings. Bones and spirits. The most ominous and foreboding atmosphere. Hel's domain." \
  90000

echo ""
echo "=== Generation complete ==="
echo "Check $OUTPUT_DIR for new tracks"
