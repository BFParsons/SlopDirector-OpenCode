# Emma Chamberlain — the chaotic self-edit

Work: the 2018–2020 vlogs ("a day in my life", "i tried thrifting", coffee videos), *Anything Goes*; the editing style copied by a generation of vloggers.

## The signature

She films herself alone, mid-thought, and then edits herself like a hostile friend: a snap zoom into her face when she says something stupid, a sound effect on a sip of coffee, a fisheye on a bad take, her own outtakes cut in as commentary, text on screen that argues with her, a voice pitched down to say what she actually meant. The energy is unhinged, self-deprecating and precise; the pace is relentless but the content is a girl in a kitchen.

## Structure — how a video is built

- No hook beyond herself starting to talk; the premise arrives in the second sentence ("today I'm going to…").
- A loose sequence of the day (getting ready, the errand, the food, the thing going wrong), each moment made into a bit by the edit: a zoom, an effect, a caption, an outtake.
- Every 30–60 s, a deliberate "mistake" kept in and pointed at (a zoom on her eye, a replay, a "what?" caption).
- The ending is abrupt: a sentence trailing off, a zoom, black.

## The cut

- Average shot 1.5–3 s; jump cuts every sentence or half-sentence; the snap zoom (`imageMotion` fast push, 0.3–0.6 s) is the punctuation; freezes and replays; nothing under 0.3 s.
- Straight cuts and jump cuts; a hard zoom in and out; a fisheye or a mirror effect on one shot per video (`effects`); no dissolves.
- Camera: handheld phone or a camera on a table, wide, natural window light, no make-up of the frame; bad framing kept when it is funny.
- Grade: slightly desaturated, film-like, a little green (`saturation` 0.9, `grain` 0.15).

## Narration — herself, and the edit

- The speech is sync, first person, rambling, self-interrupting, 150–180 wpm with long pauses she then cuts around; the edit is a second narrator: text captions and a pitched-down voice (an audio-only clip, `speed` 0.8 on a re-read line) answering her.
- Generated: `generate_narration` voice ara, "casual, tired, self-mocking, mid-thought, Gen-Z vlogger"; the edit-voice is the same line at `speed 0.75`.

## Sound

- Sound effects are the comedy: a crunch, a sip, a record scratch, a cartoon boing, a bass drop on the zoom, a vine boom (search "vlog sound effects pack CC", "record scratch", "bass drop short"); one every 15–30 s as audio-only clips on the zoom or the mistake.
- Music: a lo-fi or indie bed under the errands (search "lofi chill beat library", "indie folk instrumental CC"), ducked 8 LU, dropped out for the bits.
- Sync: everything (`muted: false`, `volume` 1); room noise kept.

## Picture — sources and text

- Sources: the project's own selfie footage; generated shots ("a young woman in a hoodie talking to a phone camera in a small kitchen, morning window light, slightly off-centre, 16:9"); outtakes are the same shots re-used at a different point.
- Text: captions in a plain typewriter or hand-written face, white, lower-third or centred, 1–2 s, that comment rather than transcribe ("she did not do that", "???", "day 1 of 1"); an arrow to something in frame; nothing branded.

## Do not

- No polished b-roll, no drone, no clean intro, no dissolves, no smooth transitions, no explanation of the bits.
- No caption that transcribes the speech; the caption argues.
- No zoom without a reason (the reason is a mistake or a lie).

## Harness parameters

asl 1.5–3 s · min shot 0.3 s · transitions cuts (jump cuts, snap zooms, freezes) · narration required as sync speech, first person rambling, 150–180 wpm · music required, lo-fi bed (out for bits) · sync sync-first · text kinetic (commenting captions) · interviews direct-address · beat-cut no

## Applying it in SlopStudio

- Plan: beats = moments of the day; each moment lists its bit (the zoom, the effect, the caption, the sound); outtake shots re-use an earlier shot id; the ending `transition: "cut"` to a black `card` 0.5 s.
- Cut: `update_segments imageMotion` fast push on the zooms, `effects` fisheye on one shot; `add_text_overlay` commenting captions (POP or OUTLINE); `add_segment audioOnly` sound effects at the zooms; a pitched-down re-read as an audio-only clip at `speed 0.75`.
- Music: `set_music` the lo-fi bed; `balance_music` gap 8; `audioFadeOutS` 0.
