# Shellback walkthrough

Record the skills you can attest to, see them on a map, and share only what you choose with your team.

> **Status: skeleton.** The screenshots below are placeholders. Zombie Admin captures them with demo data, and the Chief of Staff scans them for sensitive content before they are added (team directive 10). Until then the image links do not resolve.

## Before you start

- Windows PowerShell 5.1 (part of Windows). No administrator rights and no installer.
- Microsoft Edge or Google Chrome.
- Launch: Double-click `Launch-Shellback.bat` (serves `dist\` on `http://127.0.0.1:8765/`).
- Synthetic data only: never real personnel records or résumé PII.

## Steps

### 1. First launch

Shellback opens on **Home** with your next step. *Local demo · No login* is always shown.

![Shellback Home page on first launch, with the Local demo, No login badge and the suggested next step.](../assets/walkthrough/01-first-launch.png)

### 2. Scan a résumé

In **My profile**, paste or upload a résumé. Shellback suggests skills and credentials, and never stores the résumé text.

![Shellback My profile intake after scanning a fictional sample résumé, with skill suggestions to confirm or dismiss.](../assets/walkthrough/02-resume-intake.png)

### 3. Confirm your skills

Confirm or dismiss each suggestion, and optionally add a 0 to 4 confidence rating.

![Shellback My profile skills list with five confirmed skills and one confidence rating.](../assets/walkthrough/03-confirm-skills.png)

### 4. Explore the spider web

**Explore** shows your confirmed skills across the 13 capability domains.

![Shellback Explore spider web showing the confirmed skills across capability domains.](../assets/walkthrough/04-spider-web.png)

### 5. Explore the galaxy

Switch to the skills galaxy. Zoom, pan and select a star to inspect it.

![Shellback Explore skills galaxy in Confirmed Skills mode, with one star selected.](../assets/walkthrough/05-skills-galaxy.png)

### 6. See team coverage

In **Team**, import peer cards. Coverage shows aggregates only, and only for 3 or more people.

![Shellback Team coverage built from four fictional peer cards, showing aggregate coverage only.](../assets/walkthrough/06-team-coverage.png)

### 7. Check trust and data

**Program** lists what stays on this workstation and lets you download recovered data.

![Shellback Program page, Trust and data section, listing what stays on this workstation.](../assets/walkthrough/07-program-trust.png)

## About these images

Images live in [`docs/assets/walkthrough/`](../assets/walkthrough/), named `NN-<screen>.png` after the step they belong to. They are 1440x900 at 100% scale in the Dark theme, and show demo data only.
