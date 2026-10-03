#!/usr/bin/env bash
set -euo pipefail

mkdir -p .local-render/ci-smoke

cat > .local-render/ci-smoke/subtitles.srt <<'EOF'
1
00:00:00,100 --> 00:00:00,900
Continuity Studio render smoke test
EOF

docker compose -f docker-compose.local.yml run --rm renderer   -y   -f lavfi   -i "color=c=0x182030:s=640x360:r=30:d=1"   -f lavfi   -i "sine=frequency=440:sample_rate=48000:duration=1"   -vf "zoompan=z='1+0.03*(on/29)':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=1:s=640x360:fps=30,trim=duration=1,setpts=PTS-STARTPTS,subtitles=/work/ci-smoke/subtitles.srt:force_style='FontName=DejaVu Sans,FontSize=24,BorderStyle=3,Alignment=2'"   -t 1   -map 0:v:0   -map 1:a:0   -c:v libx264   -preset veryfast   -crf 24   -pix_fmt yuv420p   -r 30   -c:a aac   -b:a 128k   -movflags +faststart   /work/ci-smoke/output.mp4

test -s .local-render/ci-smoke/output.mp4
echo "Renderer smoke test passed."
