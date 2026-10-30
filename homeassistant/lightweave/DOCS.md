# Lightweave

Holiday themes, custom patterns and schedules for WLED lights, inside Home Assistant.

## Getting started

1. Open **Lightweave** from the sidebar.
2. In **Lights**, the WLED controllers Home Assistant already knows about are listed under **From Home Assistant**. Tap **Add** (or **Add all**). You can also add any WLED by its IP address.
3. Pick a theme and tap **Show on the lights**.

Sunrise and sunset times for schedules use Home Assistant's home location until you pick a city in **Lights → Schedules**. Schedule times use Home Assistant's time zone.

## Updates

New versions show up as **Update** on this app's page in Home Assistant. Your lights, patterns, favorites and schedules are kept.

## Good to know

- **Run Lightweave in one place only.** If it's also running elsewhere (Docker, another computer), both will fight over the same lights and both will run your schedules. Stop the other one.
- **Animated patterns are streamed** from this app to the lights, so they need it running. Still patterns and sound-reactive patterns keep going on their own.
- **Direct access:** you can enable port 8787 under the app's **Network** settings to open Lightweave at `http://<home-assistant-ip>:8787` without Home Assistant, for example as a home-screen shortcut. That address does not ask for a Home Assistant login.
- Home Assistant's WLED integration keeps working alongside Lightweave. Changing the lights from either one shows up in the other.
