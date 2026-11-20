# App Store release kit

Everything App Store Connect asks for, ready to paste. Fill these in on the **website** (appstoreconnect.apple.com → Apps → Murmurlight). The App Store Connect iPhone app can't edit versions.

## Go-live checklist

- [ ] Repo is public and GitHub Pages serves `docs/`, so the URLs below open.
- [ ] A TestFlight build plays a mix with the sleep timer, a meditation and the wind-down routine with the screen locked on a real iPhone. The sleep timer shows as a Live Activity.
- [ ] Version page: build selected, old screenshots deleted and the 2.0 set uploaded, promotional text, What's New, description, keywords, support URL, copyright.
- [ ] App Information: name `Murmurlight` and subtitle `Sleep Sound Mixer & Breathing`.
- [ ] App Information: categories, content rights, age rating.
- [ ] App Privacy: "Data Not Collected", then **Publish**.
- [ ] Regulated medical device: **No**.
- [ ] Pricing and Availability: Free.
- [ ] Screen recording from a physical iPhone attached in App Review Information, and the App Review notes pasted.
- [ ] **Add for Review → Submit to App Review**.

## Build and upload

The Expo account is out of EAS cloud build credits, so build on this Mac and submit the result. A local build uses no credits.

```bash
mkdir -p "$HOME/.eas-build-murmurlight" && EAS_LOCAL_BUILD_WORKINGDIR="$HOME/.eas-build-murmurlight" npx eas-cli@latest build --platform ios --profile production --local --output ./build/Murmurlight.ipa
```

Build in a folder under your home directory, as above. The default temp folder is reached through the `/var` shortcut to `/private/var`. There, expo-widgets writes the home screen widget's path in the `/var` form, Metro looks under `/private/var`, and the build fails with "Unable to resolve module .../src/widgets/mixes-widget.tsx".

```bash
npx eas-cli@latest submit --platform ios --profile production --path ./build/Murmurlight.ipa
```

Version 2.0 adds a widget extension for the sleep timer Live Activity (`com.pdavies.relaxationstation.ExpoWidgetsTarget`) and an app group (`group.com.pdavies.relaxationstation`). The first build after that change must create a provisioning profile for the extension, so run it **without** `--non-interactive` and sign in to Apple when EAS asks. Later builds can add `--non-interactive`.

The local build uses the Xcode on this Mac, which must be 27.1 or later for the build to count as iPhone Duo-optimized. `eas.json` keeps the `sdk-58` image pinned for cloud builds.

## URLs

| Field | Value |
| --- | --- |
| Privacy Policy URL | https://pdavies88.github.io/murmurlight/privacy/ |
| Support URL | https://pdavies88.github.io/murmurlight/support/ |
| Marketing URL (optional) | https://pdavies88.github.io/murmurlight/ |

The repo was renamed from `relaxation-station` to `murmurlight` on November 19, 2026. The old addresses under `pdavies88.github.io/relaxation-station/` forward to these, through a small redirect-only repo called `relaxation-station`. Builds 19 and earlier link to the old addresses from the About tab, so keep that redirect repo.

The app links to the privacy policy and support page from its **About** tab, as Apple requires.

## App information

| Field | Value | Limit |
| --- | --- | --- |
| Name | Murmurlight (see the note below) | 30 |
| Subtitle | Sleep Sound Mixer & Breathing | 30 |
| Primary category | Health & Fitness | |
| Secondary category | Lifestyle | |
| Content rights | No, it does not contain, show or access third-party content | |
| Copyright | 2026 Preston Davies | |
| Price | Free | |

**App name note:** version 1.2.1 was rejected on November 13, 2026 under guideline 4.3(a), spam: Apple saw it as too similar to other meditation and sound apps. Version 2.0 answers that with new features and a new name. Other developers hold "Relaxation Station" and "Lullmix", so 2.0 uses `Murmurlight`. Set it in **App Information → Name**. No live app used that name on November 14, 2026. The home screen name comes from `app.json` and is also "Murmurlight".

**Where "free" goes:** say it in the promotional text, What's New and description, and leave it out of the name, subtitle and keywords. Guideline 2.3.7 bans pricing words in those three fields, and the App Store already shows a **Get** button and "Free" for a free app.

### Promotional text (170 characters)

```
Every feature is free, for good. No subscription, no trial, no ads and no account. Mix sleep sounds, breathe with a guided pacer and fall asleep to a fading timer.
```

### What's New in 2.0 (4,000 characters)

```
Relaxation Station is now Murmurlight. Every feature is still free: no subscription, no trial, no in-app purchases and no ads.

- 15 new sounds: Birdsong, Rustling Leaves, White Noise, Green Noise, Calm Chords, Pan Flute, Soft Piano, Om Drone, Singing Bowls, Delta, Theta and Alpha binaural beats, and Delta, Theta and Alpha pulse tones. Sounds are now grouped into Nature, Steady sounds, Music, Meditative, Pulse tones and Binaural beats.
- A new look: the glowing Murmurlight orb is the new app icon.

- Sound mixer: layer up to 4 sounds and set the volume of each. Your mix is saved on your phone.
- Ready-made mixes: Rainy cabin, Night shore, Deep focus, Deep meditation, Forest morning and Nap time.
- Drift: each sound slowly rises and falls, so your mix never sounds like a loop.
- Sleep timer: 15 to 60 minutes, with a one-minute fade-out. It counts down on your Lock Screen and in the Dynamic Island.
- Breathe: a pacer that grows and shrinks with your breath, with a soft tone and a tap at each change so you can close your eyes.
- Wind down: one tap runs two minutes of breathing, a sleep meditation, then your mix with the sleep timer.
- Your mixes: name and save as many mixes as you like, up to 12.
- Home screen widget: start a saved mix with one tap.
- Bedtime reminder: an optional gentle nudge each night.
- Sleep journal: rate each night in one tap and see which sounds go with your best sleep. It stays on your phone.
- Gentle wake: an optional daily alarm with birdsong and a soft chord that rise slowly from silence.
- Apple Health: save meditations and breathing sessions as mindful minutes.
- Siri and Shortcuts: "Play Rainy cabin in Murmurlight", "Wind down with Murmurlight" or "Breathe with Murmurlight".
- A new look and a new icon.
- Optimized for iPhone Duo, and every iPhone now turns sideways.
```

### Description (4,000 characters)

```
Murmurlight is completely free. Not a free trial and not a free tier: every sound, mix, meditation and feature is yours to use, with no subscription, no in-app purchases, no ads and no account. There is nothing to unlock.

Most sleep apps put their best sounds behind a weekly subscription. Murmurlight doesn't. Build the sound that helps you sleep, keep it, and use it every night for free. Nothing you do ever leaves your phone.

YOUR OWN SOUND MIX
Layer up to 4 of 27 sounds and set each volume: Gentle Rain, Ocean Waves, Crackling Fire, Birdsong, Rustling Leaves, Wind Chimes, White Noise, Brown Noise, Green Noise, Box Fan, Car Ride, Heartbeat, Gentle Shush, Calm Chords, Pan Flute, Soft Piano, Guitar Lullaby, Music Box Lullaby, Relaxing Bells, Om Drone, Singing Bowls, three pulse tones and three binaural beats. Turn on Drift and each sound slowly rises and falls, so the mix feels like real weather instead of a loop. Name and save your favorite mixes, and start one from the home screen widget. Or start with a ready-made mix: Rainy cabin, Night shore, Deep focus, Deep meditation, Forest morning or Nap time.

BINAURAL BEATS AND PULSE TONES
Delta (2 Hz), Theta (6 Hz) and Alpha (10 Hz). With headphones, each ear hears a slightly different tone, and together they make a slow pulse. No headphones? The pulse tones are isochronic: one soft tone that pulses at the same rates, played through the speaker. Layer either under any sound.

A SLEEP TIMER THAT FADES OUT
Choose 15, 30, 45 or 60 minutes. Your mix fades out over the last minute instead of stopping with a jolt. The countdown shows on your Lock Screen and in the Dynamic Island.

WIND DOWN IN ONE TAP
Two minutes of slow breathing, a guided sleep meditation, then your mix with the sleep timer. Lock your phone after the first step and let the rest play. Turn on the bedtime reminder for a gentle nudge each night.

SLEEP JOURNAL AND GENTLE WAKE
Each morning, rate last night in one tap. The journal remembers which sounds played and shows the ones on your best nights. Wake to birdsong and a soft chord that rise slowly from silence, at a time you choose.

APPLE HEALTH AND SIRI
Save meditations and breathing sessions to Apple Health as mindful minutes. Ask Siri to play a mix, start breathing or wind down.

BREATHE
Follow an orb that grows as you breathe in and shrinks as you breathe out. Choose Box (4-4-4-4), Long exhale (4-7-8) or Even (5-5). A soft tone and a gentle tap mark each change, so it works with your eyes closed.

15 GUIDED MEDITATIONS
Sleep, Stress Relief, Breathing, Body Scan and Focus, each in 3, 5 and 10 minute sessions. Every script was written and voiced for Murmurlight.

ALWAYS FREE AND PRIVATE
- Every feature is free: no subscription, no trial and no in-app purchases
- No ads, account, tracking or analytics
- Works offline, even in airplane mode
- Keeps playing with your screen locked
- Optimized for iPhone Duo, and works upright or sideways

The meditations are for relaxation and general wellbeing. They are not medical advice or treatment.
```

### Keywords (100 characters, comma-separated, no spaces after commas)

```
sleep sounds,binaural beats,sound mixer,white noise,brown noise,rain,breathing,sleep timer,nap
```

## App Privacy questionnaire

App Store Connect → **App Privacy → Get Started**.

1. **Do you or your third-party partners collect data from this app?** **No, we do not collect data from this app.**
2. Click **Publish**.

The label then shows **Data Not Collected**. This matches the app's privacy manifest, which declares no collected data types. The app has no network code, accounts, analytics or ads.

## Age rating

Answer **None** or **No** to every content question: violence, sexual content, profanity, drugs, gambling, horror and so on. Then:

| Question | Answer | Why |
| --- | --- | --- |
| Medical or Treatment Information | **None** | It offers relaxation, not diagnosis or treatment. |
| Health or Wellness Topics | **Yes** | Meditation and sleep are wellness topics. |
| Unrestricted web access | No | It only opens its own privacy and support pages. |
| User-generated content, messaging, advertising | No | |

Result, saved November 2, 2026: 9+ in 172 countries and regions, 12+ in Vietnam, and Korea's "ALL" rating. Devices on operating systems earlier than version 26 show 4+. Answering Yes to Health or Wellness Topics raises the rating from 4+ to 9+. Yes is the honest answer for a meditation app, and guideline 2.3.6 requires honest answers.

**Regulated medical device** (EU, UK, US): **No**.

## App Review information

| Field | Value |
| --- | --- |
| Sign-in required | No |
| Contact name, phone and email | Yours. Apple uses these only to reach you. |

### Notes

Version 2.0 replies to the guideline 4.3(a) rejection of 1.2.1. Record the screen recording below and attach it in **App Review Information → Attachment**, then paste this text into the **Notes** field. Paste the first section as your reply to the rejection in App Store Connect too.

```
RESPONSE TO THE 4.3(a) REJECTION OF 1.2.1
Thank you for the review. We agreed that 1.2.1 looked like other meditation and sound apps, so 2.0 adds features built for this app and a new, unique name (Murmurlight, formerly Relaxation Station):
- Sound mixer: layer up to 4 of 27 sounds with a volume for each, saved on the device. Six ready-made mixes.
- Binaural beats and isochronic pulse tones: Delta, Theta and Alpha, generated for this app. The pulse tones work without headphones. No health claims are made.
- Drift: each sound's volume slowly rises and falls on its own wave, so the mix never repeats like a loop.
- Sleep timer with a one-minute fade-out, shown as a Live Activity on the Lock Screen and in the Dynamic Island.
- Breathe tab: a breathing pacer with three patterns, and soft tones and haptic taps at each change, usable with eyes closed.
- Named saved mixes (up to 12) and a home screen widget that starts a saved mix with one tap.
- Optional bedtime reminder: a local daily notification. Permission is asked only when the user picks a time, and the app works fully without it. No server.
- Sleep journal: a one-tap morning rating that remembers which sounds played that night and shows the sounds on the user's best nights. Stored only on the device.
- Gentle wake alarm (AlarmKit on iOS 26, a local notification on earlier versions) with a sound made for this app. Permission is asked only when the user picks a time.
- Apple Health: optional, off by default. Writes mindful minutes only and reads nothing.
- Siri and Shortcuts (App Intents): play a saved or ready-made mix, start breathing, or start the wind-down routine.
- Wind-down routine: one tap runs 2 minutes of paced breathing, a guided sleep meditation, then the user's mix with the sleep timer. The mix starts automatically when the meditation ends, with the screen locked.
- Every feature is free, with no account, ads, tracking or network access. Most apps in this category lock these features behind a subscription.

This app was not made from a template or purchased code. The developer wrote the code for this app. All 15 meditation scripts were written for it, the narration was generated for it, and all 27 sounds were synthesized for it. The developer has no other meditation or sound apps.

1. SCREEN RECORDING
Attached: a recording on a physical iPhone, starting from launch. It shows building a mix, Drift, the sleep timer and its Live Activity, the Breathe tab, the wind-down routine with the screen locked, and the About tab. The app has no login, user-generated content or in-app purchases.

2. PURPOSE AND AUDIENCE
Murmurlight is for anyone who wants to fall asleep, nap or relax. Its core is the sound mixer and sleep timer. Breathing and meditation help users wind down first.

3. SETUP AND TEST INSTRUCTIONS
No login or setup is needed. All audio is bundled.
a. Sounds tab: tap Gentle Rain, then Crackling Fire. Both play together. Drag each volume bar. Turn on Drift.
b. Choose a 15 minute sleep timer, then lock the iPhone: the countdown shows on the Lock Screen and in the Dynamic Island, and the mix keeps playing.
c. Tap a ready-made mix, such as Rainy cabin, to replace the mix.
d. Breathe tab: choose Box and tap Start breathing. The orb grows and shrinks, with a haptic tap at each change.
e. Meditate tab: tap Wind down, then Start wind-down. Tap Skip to the meditation and Skip to the mix to see all three steps quickly.
f. Meditate tab: tap any meditation, for example Settle In, to open the player.
g. Sounds tab: tap Save on the mix card, name the mix, and it appears under Your mixes. Add the Murmurlight widget from the home screen to start it with one tap.
h. Meditate tab: choose a Bedtime reminder time. The app asks for notification permission at that moment.
i. Meditate tab: before 2 PM, the "How did you sleep?" card appears. Tap a rating, then open Sleep journal.
j. Meditate tab: choose a Gentle wake time. The app asks for alarm permission at that moment.
k. About tab: turn on Apple Health. The Health permission sheet asks to write mindful minutes only. Then run a breathing session for over a minute and tap Stop. It appears in the Health app under Mindfulness.
l. Siri: say "Breathe with Murmurlight" or "Play Rainy cabin in Murmurlight". The actions also appear in the Shortcuts app.
m. About tab: links to the privacy policy and support page.

BACKGROUND AUDIO
The "audio" background mode keeps the mix and meditations playing with the screen locked. That is the app's core purpose: users fall asleep to their mix.

4. EXTERNAL SERVICES
None: no backend, network, accounts, payments, analytics, ads or AI.
HealthKit: the app only writes mindful minutes, and only after the user turns it on in the About tab. It reads no health data, and nothing is sent off the device.

5. REGIONAL DIFFERENCES
None.

6. REGULATED INDUSTRY AND THIRD-PARTY MATERIAL
Not a medical device and no medical claims. The app states that it is not medical advice or treatment.
All content was made for this app. The narration was generated with the open-source Qwen3-TTS model (Apache 2.0, which permits commercial use). "Music Box Lullaby" is a new recording of Brahms' Lullaby (1868), which is in the public domain.
```

### Screen recording to attach

Record on a physical iPhone running the latest iOS, in about 3 minutes. Install the submitted build from TestFlight first.

1. Add **Screen Recording** to Control Center (Settings → Control Center) if it isn't there. Start a recording from Control Center.
2. On the Home Screen, tap the Murmurlight icon.
3. **Sounds** tab: tap Gentle Rain and Crackling Fire, drag both volume bars, and turn on Drift. Choose a 15 minute sleep timer.
4. Lock the phone and wake it to show the Live Activity counting down. Unlock.
5. Tap the **Rainy cabin** ready-made mix.
6. **Breathe** tab: tap **Start breathing** and follow two breaths. Tap **Stop**.
7. **Meditate** tab: tap **Wind down**, then **Start wind-down**. After a few breaths, tap **Skip to the meditation**, lock the phone, unlock it, then tap **Skip to the mix**. Tap **Done**.
8. Turn the phone sideways on the Sounds tab, then turn it back.
9. **About** tab: tap **Privacy policy**.
10. Stop the recording. It's saved to Photos. AirDrop it to your Mac and attach it in App Store Connect. If the file is too large, export a 1080p copy with QuickTime (File → Export As).

## Screenshots

All screenshots come from a Release build of version 2.0.0 on the iPhone 18 Pro Max simulator with a clean 9:41 status bar, captured on November 14, 2026. They lead with the sound mixer, because it is what makes 2.0 different. Upload them in this order:

1. `01-sound-mixer.png`: the Rainy cabin mix playing, with a 30 minute sleep timer and Drift on
2. `02-sleep-timer.png`: the sleep timer Live Activity on the Lock Screen
3. `03-wind-down.png`: the three-step Wind down routine
4. `04-breathe.png`: the breathing pacer mid-breath
5. `05-meditate.png`: the Meditate tab with the Wind down card, bedtime reminder and gentle wake
6. `06-sounds-dark.png`: the sound categories and volume bars in dark mode
7. `07-sleep-journal.png`: the sleep journal, filled with sample nights

| Folder | Size | App Store Connect slot |
| --- | --- | --- |
| `screenshots/` | 1320 × 2868 | 6.9" display |
| `screenshots/6.3-inch/` | 1206 × 2622 | 6.1" / 6.3" display, resized from the 6.9" set |
| `screenshots/iphone-duo/` | 2853 × 2007 | iPhone Duo, the unfolded inner display |

**Delete the old screenshots in App Store Connect** before uploading, including the old iPhone Duo set, then upload the new Duo set. They show version 1.2.1, and screenshots must match the app (guideline 2.3.3).

### iPhone Duo screenshots

Ready to upload, in [`screenshots/iphone-duo/`](screenshots/iphone-duo/): seven screenshots, 2853 × 2007 pixels, the unfolded inner display, from the same 2.0.0 Release build on the iPhone Duo simulator. Uploading them adds a badge to the product page saying the app is optimized for iPhone Duo, and Apple requires them from April 2027. Upload them in the same order as the iPhone set. Unfolded, the tabs run down the right edge, Breathe shows the orb beside its controls, and the player opens as a sheet.

The Duo simulator has two displays. Capture the inner one with `xcrun simctl io <UDID> screenshot --display=3 <file>.png`. If the inner display freezes on one frame, fold and unfold the simulator in Device Hub.

### Retaking screenshots

1. Build a Release version: `npx expo run:ios --configuration Release --device <UDID>`.
2. Set the status bar with `xcrun simctl status_bar <UDID> override --time 9:41 --batteryState discharging --batteryLevel 100`.
3. Switch themes with `xcrun simctl ui <UDID> appearance dark` or `light`.
4. Save each screen with `xcrun simctl io <UDID> screenshot <file>.png`.
5. Make the 6.3" copies with `for f in 0*.png; do sips -z 2622 1206 "$f" --out "6.3-inch/$f"; done` from `store/screenshots/`.

The simulator ignores very short taps on switches. Slide the Drift switch instead of tapping it.

## iPhone Duo

Apple treats a build as optimized for iPhone Duo when it's made with Xcode 27.1 (the iOS 27.1 SDK) or later. Older builds run in a smaller window on the inner display.

What the app does on iPhone Duo:

- **Inner display:** the app fills the screen. Content stays centered with a maximum width of 800 points, and the tabs run down the right edge.
- **Landscape:** the hero shrinks, and the player puts its controls beside the orb, so nothing needs a scroll. Checked on the iPhone 18 Pro Max simulator. The Duo's outer display in landscape uses the same layout but hasn't been checked on the simulator yet.
- **Cold launch while unfolded:** `patches/react-native-screens+4.30.1.patch` makes the tab bar appear. Without it, the tab bar is missing until the device folds or rotates. See the main README.
- **Not yet tested:** the outer display in landscape, and folding while a meditation plays.

## After approval

- If you chose manual release, click **Release This Version**.
- For each update, bump `version` in `app.json`. EAS raises the build number automatically.
