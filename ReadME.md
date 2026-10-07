# WebUntis Auto Navigation

A Tampermonkey userscript that automatically navigates to your class schedule on WebUntis.

## Features

- Automatically clicks your school from the WebUntis homepage  
- Navigates to the timetable (**Stundenplan**) page  
- Shows a **class picker** before selecting the class (default: `5a`)  
  - Real class list loaded from WebUntis, grouped by grade, with search  
  - Auto-continues with your remembered class after 6 seconds unless you pick another one  
  - Your choice is remembered; turn off "Ask me every time" to skip the picker  
  - A floating 🎓 button (bottom right) lets you switch class at any time  
- Reliably opens the WebUntis class dropdown (it reacts to `mousedown`, not `click`)  
- Fast and reliable navigation with intelligent retry logic

---

## 🚀 Quick Start

### Option 1 – Clone & Install Manually

You can also clone the repository and install it manually.

```bash
# Clone the repository
git clone https://github.com/username/Webuntis-Automation.git

# Navigate into the project folder
cd Webuntis-Automation

# Open the script file in your editor
code WebUntis-Auto-Navigation.user.js

Then:

    Open Tampermonkey Dashboard

    Click the “+” (Add new script) button

    Paste the contents of WebUntis-Auto-Navigation.user.js

    Save (Ctrl+S or Cmd+S)

🧩 Prerequisites

You need a userscript manager extension installed in your browser:

    Chrome / Edge / Brave → Tampermonkey

Firefox → Tampermonkey
or Greasemonkey

Safari → Userscripts
⚙️ Configuration

To customize the script for your school and class:

    Open Tampermonkey Dashboard

    Click the edit icon next to WebUntis Auto Navigation

    You normally don't need to edit anything: pick your class in the picker that
appears on the timetable page, or click the 🎓 button in the bottom-right corner.

To change the default class used before you've picked one, edit this line near the top:

const DEFAULT_CLASS = "5a";

School Configuration

If your school differs from the default one, update the school link:

const SCHOOL = "htl-shkoder";

Replace htl-shkoder with your school’s identifier from your WebUntis URL.
🧠 How It Works

The script performs three main automated actions:

    Selects your school – clicks your school link on the homepage

    Navigates to Timetable – clicks the “Stundenplan” menu

    Asks for your class – then opens the dropdown, searches, and selects it

All steps include intelligent retry logic to handle slow loading.
🧰 Troubleshooting
Script doesn’t run

    Ensure Tampermonkey is installed and enabled

    Open Tampermonkey Dashboard and make sure the script toggle is ON

    Press F12 → Console and check for logs that start with the script emoji indicators

Console Log Messages

    🚀 Script loaded

    ✅ Found elements

    🖱️ Clicked elements

    ❌ Element not found or retrying

Common Fixes

    If the 🎓 button shows "retry", click it and pick the class again

    If your school page loads slowly, the script will retry automatically

    If nothing happens, your school URL or WebUntis structure might differ slightly

🔒 Privacy & Security

This userscript:

    Runs only on WebUntis domains

    Does not collect or send any data

    Requires no special permissions

    All code is open source and auditable

🤝 Contributing

You can contribute by:

    Reporting bugs or issues

    Suggesting improvements

    Submitting pull requests

Repository: github.com/aidenmjeda/Webuntis-Automation
📄 License

Released under the MIT License – free to use, modify, and distribute.
⚠️ Disclaimer

This is an unofficial userscript and not affiliated with Untis GmbH.
Use at your own discretion — the script automates navigation only and does not access or modify sensitive data.

Version: 2026-10-07
Author: Aiden Mjeda


---

