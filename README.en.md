# mcd-desktop-pet

[简体中文](README.md) | [English](README.en.md)

![McDonald's desktop pet](assets/cover.jpeg)

Meet **Fries Buddy** (薯条小宝), a McDonald's-inspired companion that lives in a corner of your desktop.

Buddy can stroll around your screen, react to a friendly pat, and remind you to take a lunch break. With the web console, you can also claim coupons, look up food nutrition, and access McDonald's China MCP services. The project includes 33 built-in tool definitions; actual availability depends on the official service and your account permissions.

This independently developed project is an entry in the McDonald's Developer Innovation Challenge. It is not an official McDonald's product.

![Everyday interactions with the desktop pet](assets/desktop-preview.gif)

## Who It Is For

- **People who work or study at a computer:** enjoy a desktop companion and reminders to make time for lunch and breaks.
- **Users of McDonald's China services:** browse coupons, campaigns, nutrition information, and points through a graphical interface without manually assembling tool arguments.
- **Developers using AI agents:** use the provided [Skill](skill/SKILL.md) and CLI to turn natural-language requests into MCP calls, with actions and speech bubbles showing the results.

The pet provides visual feedback for queries and tasks, while the web console displays detailed results and lets you call tools manually.

| Step 1: Lunch reminder | Step 2: Claim coupons | Step 3: Meal suggestions |
|:---|:---|:---|
| ![Lunch reminder](assets/step1.png) | ![Claim coupons](assets/step2.png) | ![Meal suggestions](assets/step3.png) |
| **Step 4: Confirm an order** | **Step 5: Delivery updates** | **Step 6: Food arrives** |
| ![Confirm an order](assets/step4.png) | ![Delivery updates](assets/step5.png) | ![Food arrives](assets/step6.png) |

This six-step showcase is driven by a simulation script. Coupons, meal suggestions, ordering, delivery updates, and arrival messages use preset content or mock results. See [Simulated Demo](#simulated-demo) to reproduce it.

## Desktop Companion

### Interactions and Animations

- **Click to interact:** left-click Buddy to trigger a cheerful bounce and a speech bubble. Buddy also strolls around the desktop when idle.
- **Choose an action:** right-click to make Buddy walk, rest, jump, or wave.
- **Drag to move:** hold the left mouse button and drag Buddy to another part of the screen.

### Lunch Reminders

- **Daily reminder:** the default lunch time is 12:00, with a reminder 10 minutes beforehand.
- **Custom schedule:** choose presets such as 11:30, 12:00, or 12:30 from the context menu, or enter a custom time and reminder lead time.
- **Instant preview:** select “Test lunch reminder now” (立即测试午休提醒) from the context menu to preview the reminder and animation.

### Full-Screen Display

Use the context menu to toggle “Show pet in full-screen apps” (在全屏应用中显示桌宠), depending on whether you want Buddy visible while watching videos or working in full-screen mode.

## Web Console

Right-click Buddy and choose **“Open Web Console” (打开 Web 控制台)** to access the graphical management interface.

![Web console preview](assets/webui-preview.png)

The console provides access to MCP tools whose results come from the official McDonald's service:

- **Coupons:** claim currently available coupons and view your coupons and their expiration dates.
- **Campaign calendar:** check the month's promotions and upcoming limited-time products.
- **Nutrition lookup:** search for food items and view the returned energy, protein, fat, and other nutrition information.
- **Points and merchandise:** check your points balance and access points lotteries and merchandise redemption tools.
- **Stores and ordering:** find nearby stores and check their available services.
- **More tools:** access themed event reservations, order queries, and other tools. See the built-in tool catalog in the [MCP integration guide](MCP_INTEGRATION.md#工具与业务价值) (Chinese).

Regular tool calls go through the local server to McDonald's MCP. The [MCP integration guide](MCP_INTEGRATION.md) explains the real and simulated request paths. The architecture and workflows are still evolving; issues and pull requests are welcome.

---

## Quick Start Guide

### 1. Download & Zero-Setup Launch

The application is distributed as a self-contained compiled binary; simply download, extract, and click to run:

- **Windows**: Download `mcd-desktop-pet.exe` and **double-click to run**. Buddy will appear on your desktop with an ultra-lightweight ~15MB memory footprint.
- **macOS**: Download the `mcd-desktop-pet.app` application bundle, drag it to `/Applications`, and **double-click to open** (if blocked by Gatekeeper, click "Open Anyway" under System Settings -> Privacy & Security).

> 💡 **Click-to-Serve**: Running with no arguments is strictly equivalent to `mcd-desktop-pet start`. Both GUI clicks and CLI calls share the same underlying lifecycle scheduler, automatically starting the Go background daemon and the Godot desktop pet renderer. If already running, existing instances are reused.

---

## Competition Materials

The project provides the following materials for the [Developer Innovation Challenge](https://github.com/M-China/mcd-developer-innovation-challenge) and its [full rules](https://github.com/M-China/mcd-developer-innovation-challenge/blob/main/activityGuidelines.md):

| File | Contents |
|:---|:---|
| [README.md](README.md) / [README.en.md](README.en.md) | Project overview, target users, installation, and usage examples in Chinese and English |
| [CONTEST_DECLARATION.md](CONTEST_DECLARATION.md) | Official competition declaration, preserved in its original form |
| [MCP_INTEGRATION.md](MCP_INTEGRATION.md) | MCP server, tools, request flow, business value, and verification instructions (Chinese) |
| [mcp-config.example.json](mcp-config.example.json) | Example MCP connection configuration with environment-variable placeholders for the endpoint and credentials |

---

## License

The project code is available under the [MIT License](LICENSE). Rights to McDonald's trademarks and related assets remain with their respective owners and are not transferred by the code license. Project output is for reference only and does not constitute medical, nutritional, or other professional advice. Food information, prices, and availability are subject to current results from official McDonald's channels.

