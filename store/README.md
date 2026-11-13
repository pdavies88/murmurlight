# App Store release kit

Everything App Store Connect asks for, ready to paste. Fill these in on the **website** (appstoreconnect.apple.com → Apps → Lullmix). The App Store Connect iPhone app can't edit versions.

## Go-live checklist

- [ ] Repo is public and GitHub Pages serves `docs/`, so the URLs below open.
- [ ] A TestFlight build plays a mix with the sleep timer, a meditation and the wind-down routine with the screen locked on a real iPhone. The sleep timer shows as a Live Activity.
- [ ] Version page: build selected, old screenshots deleted and the 2.0 set uploaded, promotional text, What's New, description, keywords, support URL, copyright.
- [ ] App Information: name `Lullmix` and subtitle `Sleep Sound Mixer & Breathing`.
- [ ] App Information: categories, content rights, age rating.
- [ ] App Privacy: "Data Not Collected", then **Publish**.
- [ ] Regulated medical device: **No**.
- [ ] Pricing and Availability: Free.
- [ ] Screen recording from a physical iPhone attached in App Review Information, and the App Review notes pasted.
- [ ] **Add for Review → Submit to App Review**.

## Build and upload

The Expo account is out of EAS cloud build credits, so build on this Mac and submit the result. A local build uses no credits.

```bash
npx eas-cli@latest build --platform ios --profile production --local --output ./build/Lullmix.ipa
```

```bash
npx eas-cli@latest submit --platform ios --profile production --path ./build/Lullmix.ipa
```

Version 2.0 adds a widget extension for the sleep timer Live Activity (`com.pdavies.relaxationstation.ExpoWidgetsTarget`) and an app group (`group.com.pdavies.relaxationstation`). The first build after that change must create a provisioning profile for the extension, so run it **without** `--non-interactive` and sign in to Apple when EAS asks. Later builds can add `--non-interactive`.

The local build uses the Xcode on this Mac, which must be 27.1 or later for the build to count as iPhone Duo-optimized. `eas.json` keeps the `sdk-58` image pinned for cloud builds.

## URLs

| Field | Value |
| --- | --- |
| Privacy Policy URL | https://pdavies88.github.io/relaxation-station/privacy/ |
| Support URL | https://pdavies88.github.io/relaxation-station/support/ |
| Marketing URL (optional) | https://pdavies88.github.io/relaxation-station/ |

The app links to the privacy policy and support page from its **About** tab, as Apple requires.

## App information

| Field | Value | Limit |
| --- | --- | --- |
| Name | Lullmix (see the note below) | 30 |
| Subtitle | Sleep Sound Mixer & Breathing | 30 |
| Primary category | Health & Fitness | |
| Secondary category | Lifestyle | |
| Content rights | No, it does not contain, show or access third-party content | |
| Copyright | 2026 Preston Davies | |
| Price | Free | |

**App name note:** version 1.2.1 was rejected on November 13, 2026 under guideline 4.3(a), spam: Apple saw it as too similar to other meditation and sound apps. Version 2.0 answers that with new features and a new name. Another developer holds "Relaxation Station", so the store name was "Relaxation Station: Sleep". For 2.0, change **App Information → Name** to `Lullmix`. No live app used that name on November 13, 2026. The home screen name comes from `app.json` and is also "Lullmix".

### Promotional text (170 characters)

```
Build your own sleep sound mix, breathe with a guided pacer and drift off with a sleep timer. Free forever: no subscription, no account, no ads, and it works offline.
```

### What's New in 2.0 (4,000 characters)

```
Relaxation Station is now Lullmix, with new ways to wind down. Everything is still free.

- Sound mixer: layer up to 4 sounds and set the volume of each. Your mix is saved on your phone.
- Ready-made mixes: Rainy cabin, Night shore, Deep focus and Nap time.
- Drift: each sound slowly rises and falls, so your mix never sounds like a loop.
- Sleep timer: 15 to 60 minutes, with a one-minute fade-out. It counts down on your Lock Screen and in the Dynamic Island.
- Breathe: a pacer that grows and shrinks with your breath, with a tap at each change so you can close your eyes.
- Wind down: one tap runs two minutes of breathing, a sleep meditation, then your mix with the sleep timer.
- Optimized for iPhone Duo, and every iPhone now turns sideways.
```

### Description (4,000 characters)

```
Lullmix is a free sleep sound mixer with guided breathing and meditation. Build the sound that helps you sleep, and keep it. No subscription, no account, no ads, and nothing ever leaves your phone.

YOUR OWN SOUND MIX
Layer up to 4 of 12 sounds and set each volume: Gentle Rain, Wind Chimes, Ocean Waves, Music Box Lullaby, Heartbeat, Crackling Fire, Guitar Lullaby, Box Fan, Brown Noise, Relaxing Bells, Car Ride and Gentle Shush. Turn on Drift and each sound slowly rises and falls, so the mix feels like real weather instead of a loop. Lullmix saves your mix, so it's one tap away tomorrow night. Or start with a ready-made mix: Rainy cabin, Night shore, Deep focus or Nap time.

A SLEEP TIMER THAT FADES OUT
Choose 15, 30, 45 or 60 minutes. Your mix fades out over the last minute instead of stopping with a jolt. The countdown shows on your Lock Screen and in the Dynamic Island.

WIND DOWN IN ONE TAP
Two minutes of slow breathing, a guided sleep meditation, then your mix with the sleep timer. Lock your phone after the first step and let the rest play.

BREATHE
Follow an orb that grows as you breathe in and shrinks as you breathe out. Choose Box (4-4-4-4), Long exhale (4-7-8) or Even (5-5). A gentle tap marks each change, so it works with your eyes closed.

15 GUIDED MEDITATIONS
Sleep, Stress Relief, Breathing, Body Scan and Focus, each in 3, 5 and 10 minute sessions. Every script was written and voiced for Lullmix.

FREE AND PRIVATE
- Every feature is free. There is nothing to unlock.
- No account, ads, tracking or analytics
- Works offline, even in airplane mode
- Keeps playing with your screen locked
- Optimized for iPhone Duo, and works upright or sideways

The meditations are for relaxation and general wellbeing. They are not medical advice or treatment.
```

### Keywords (100 characters, comma-separated, no spaces after commas)

```
sleep sounds,sound mixer,white noise,brown noise,rain,breathing,sleep timer,meditation,nap,offline
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
Thank you for the review. We agreed that 1.2.1 looked like other meditation and sound apps, so 2.0 adds features built for this app and a new, unique name (Lullmix, formerly Relaxation Station):
- Sound mixer: layer up to 4 of 12 sounds with a volume for each, saved on the device. Four ready-made mixes.
- Drift: each sound's volume slowly rises and falls on its own wave, so the mix never repeats like a loop.
- Sleep timer with a one-minute fade-out, shown as a Live Activity on the Lock Screen and in the Dynamic Island.
- Breathe tab: a breathing pacer with three patterns and haptic taps at each change, usable with eyes closed.
- Wind-down routine: one tap runs 2 minutes of paced breathing, a guided sleep meditation, then the user's mix with the sleep timer. The mix starts automatically when the meditation ends, with the screen locked.
- Every feature is free, with no account, ads, tracking or network access. Most apps in this category lock these features behind a subscription.

This app was not made from a template or purchased code. The developer wrote the code for this app. All 15 meditation scripts were written for it, the narration was generated for it, and all 12 sounds were synthesized for it. The developer has no other meditation or sound apps.

1. SCREEN RECORDING
Attached: a recording on a physical iPhone, starting from launch. It shows building a mix, Drift, the sleep timer and its Live Activity, the Breathe tab, the wind-down routine with the screen locked, and the About tab. The app has no login, user-generated content or in-app purchases.

2. PURPOSE AND AUDIENCE
Lullmix is for anyone who wants to fall asleep, nap or relax. Its core is the sound mixer and sleep timer. Breathing and meditation help users wind down first.

3. SETUP AND TEST INSTRUCTIONS
No login or setup is needed. All audio is bundled.
a. Sounds tab: tap Gentle Rain, then Crackling Fire. Both play together. Drag each volume bar. Turn on Drift.
b. Choose a 15 minute sleep timer, then lock the iPhone: the countdown shows on the Lock Screen and in the Dynamic Island, and the mix keeps playing.
c. Tap a ready-made mix, such as Rainy cabin, to replace the mix.
d. Breathe tab: choose Box and tap Start breathing. The orb grows and shrinks, with a haptic tap at each change.
e. Meditate tab: tap Wind down, then Start wind-down. Tap Skip to the meditation and Skip to the mix to see all three steps quickly.
f. Meditate tab: tap any meditation, for example Settle In, to open the player.
g. About tab: links to the privacy policy and support page.

BACKGROUND AUDIO
The "audio" background mode keeps the mix and meditations playing with the screen locked. That is the app's core purpose: users fall asleep to their mix.

4. EXTERNAL SERVICES
None. No backend, network requests, accounts, payments, analytics, ads or AI services.

5. REGIONAL DIFFERENCES
None.

6. REGULATED INDUSTRY AND THIRD-PARTY MATERIAL
Not a medical device and no medical claims. The app states that it is not medical advice or treatment.
All content was made for this app. The narration was generated with the open-source Qwen3-TTS model (Apache 2.0, which permits commercial use). "Music Box Lullaby" is a new recording of Brahms' Lullaby (1868), which is in the public domain.
```

### Screen recording to attach

Record on a physical iPhone running the latest iOS, in about 3 minutes. Install the submitted build from TestFlight first.

1. Add **Screen Recording** to Control Center (Settings → Control Center) if it isn't there. Start a recording from Control Center.
2. On the Home Screen, tap the Lullmix icon.
3. **Sounds** tab: tap Gentle Rain and Crackling Fire, drag both volume bars, and turn on Drift. Choose a 15 minute sleep timer.
4. Lock the phone and wake it to show the Live Activity counting down. Unlock.
5. Tap the **Rainy cabin** ready-made mix.
6. **Breathe** tab: tap **Start breathing** and follow two breaths. Tap **Stop**.
7. **Meditate** tab: tap **Wind down**, then **Start wind-down**. After a few breaths, tap **Skip to the meditation**, lock the phone, unlock it, then tap **Skip to the mix**. Tap **Done**.
8. Turn the phone sideways on the Sounds tab, then turn it back.
9. **About** tab: tap **Privacy policy**.
10. Stop the recording. It's saved to Photos. AirDrop it to your Mac and attach it in App Store Connect. If the file is too large, export a 1080p copy with QuickTime (File → Export As).

## Screenshots

All screenshots come from a Release build of version 2.0.0 on the iPhone 18 Pro Max simulator with a clean 9:41 status bar, captured on November 13, 2026. They lead with the sound mixer, because it is what makes 2.0 different. Upload them in this order:

1. `01-sound-mixer.png`: the Rainy cabin mix playing, with a 30 minute sleep timer and Drift on
2. `02-sleep-timer.png`: the sleep timer Live Activity on the Lock Screen
3. `03-wind-down.png`: the three-step Wind down routine
4. `04-breathe.png`: the breathing pacer mid-breath
5. `05-meditate.png`: the Meditate tab with the Wind down card and sleep meditations
6. `06-sounds-dark.png`: the mixer in dark mode

| Folder | Size | App Store Connect slot |
| --- | --- | --- |
| `screenshots/` | 1320 × 2868 | 6.9" display |
| `screenshots/6.3-inch/` | 1206 × 2622 | 6.1" / 6.3" display, resized from the 6.9" set |

**Delete the old screenshots in App Store Connect** before uploading, including the old iPhone Duo set. They show version 1.2.1, and screenshots must match the app (guideline 2.3.3).

### iPhone Duo screenshots

There is no iPhone Duo set for 2.0 yet. Apple requires one from April 2027, and it adds the "optimized for iPhone Duo" badge. To make one, unfold the iPhone Duo simulator in Device Hub, run the Release build on it, and capture the same screens at 2853 × 2007.

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
