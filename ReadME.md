# WebUntis Auto Navigation

A Tampermonkey userscript that automatically navigates to your class schedule on WebUntis.

## Features

- Automatically clicks your school from the WebUntis homepage  
- Navigates to the timetable (**Stundenplan**) page  
- Selects your configured class (default: `4a`)  
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

    Find this section near the top:

// --- Configuration ---
const TARGET_CLASS = "4a"; // Change this to your target class

    Change "4a" to your class name (e.g. "5b", "3a", etc.)

    Save the script

School Configuration

If your school differs from the default one, update the school link:

const schoolLink = document.querySelector('a.visited-school[href="https://hektor.webuntis.com/WebUntis/?school=htl-shkoder"]');

Replace htl-shkoder with your school’s identifier from your WebUntis URL.
🧠 How It Works

The script performs three main automated actions:

    Selects your school – clicks your school link on the homepage

    Navigates to Timetable – clicks the “Stundenplan” menu

    Selects your class – opens dropdown, searches, and selects your class

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

    Make sure the class name matches exactly (case-sensitive)

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

Version: 2025-10-05
Author: Aiden Mjeda


---

