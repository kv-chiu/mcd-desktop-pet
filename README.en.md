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

## Quick Start

### Download and Launch

Install **Node.js 22**, matching the version used in CI, and check that `node --version` prints a version number. The server and CLI in release packages still require Node.js. You do not need Godot or pnpm to run the packaged desktop pet.

Download the archive for your operating system from [Releases](https://github.com/kv-chiu/mcd-desktop-pet/releases). If a suitable release package is unavailable, follow [Run from Source](#run-from-source).

#### Windows

1. Extract the downloaded archive.
2. Double-click `start.bat`. Buddy will appear near the bottom-right corner of your desktop.
3. The script also starts the local server and opens the console at [http://localhost:3001](http://localhost:3001) by default.
4. Double-click `stop.bat` to stop the full stack. Choosing “Quit pet” from Buddy's context menu only closes the desktop client.

#### macOS

1. Extract the downloaded archive.
2. Open a terminal in the extracted directory and run `./start.sh` to start the server, desktop pet, and browser console. The default console address is [http://localhost:3001](http://localhost:3001).
3. Opening `McdDesktopPet.app` directly starts only the desktop client. Start the local server as well to use MCP or the web console.
4. Run `./stop.sh` to stop the full stack.

#### Linux

1. Extract the matching `.tar.gz` release package and open a terminal in that directory in a graphical desktop environment.
2. Run `./start.sh` to start the server and desktop pet, then visit [http://localhost:3001](http://localhost:3001) for the console.
3. Run `./stop.sh` to stop the full stack.

### Configure Your McDonald's MCP Token

Open the web console after startup:

1. Get your personal MCP token from the [McDonald's Open Platform](https://open.mcd.cn/mcp).
2. Paste it into the token field at the top of the console. It is automatically saved in the current browser's local storage; no save button is needed.
3. Click “Test connection” (测试连接). Wait for the “Connected” (已连接) status before calling tools.

The web token is stored in the current browser's `localStorage`. Each request sends it to the local server, which forwards it to the configured McDonald's MCP endpoint. The CLI uses the server's separate configuration: entering a token in the web console does not configure the CLI.

For the CLI, set `MCD_MCP_TOKEN` before starting the server, or persist a token through `config set-token` while the server is running. For example, from a macOS or Linux release directory, with `MCD_MCP_TOKEN` already set in your terminal:

```bash
./mcd config set-token "${MCD_MCP_TOKEN:?Set MCD_MCP_TOKEN first}" --json
```

The persisted token is stored in `~/.mcd-desktop-pet/config.json`. Existing values in that file override the server's environment-based defaults. See the [configuration and credential storage guide](MCP_INTEGRATION.md#配置与凭证存储) (Chinese) for details.

### Example: Look Up Food Nutrition

1. Start the services, configure your token, and complete the connection test.
2. Select `list-nutrition-foods` in the console.
3. Set `keyword` to `巨无霸` (Big Mac), then click “Execute tool” (执行工具).
4. Read the nutrition information in the results panel. When the desktop pet is connected, it can respond with an action and speech bubble based on the evaluated business result.

Values come from the current official response. If a request fails, check your token, network connection, and the displayed error. Seeing the tool catalog does not by itself confirm a successful live MCP call.

### AI Agents and CLI

The project includes an [Agent Skill](skill/SKILL.md) (Chinese). Give it to a compatible agent to request tasks such as “Look up the nutrition information for a Big Mac” or “Claim my available coupons” through the local CLI.

From a macOS or Linux release directory:

```bash
./mcd nutrition 巨无霸 --json
./mcd calendar --json
```

On Windows, use `.\mcd.bat` instead of `./mcd`. These business commands require the local server to be running with its own token configured through the CLI or environment variables.

## Mouse Controls

| Control | Action |
|:---|:---|
| Left-click | Pat Buddy to trigger a bounce and a random speech bubble |
| Hold left mouse button and drag | Move Buddy to another position on the screen |
| Right-click | Open the menu for actions, lunch settings, and the web console |

## FAQ

**Will Buddy get in the way of my work?**

Buddy occupies a small area and can be dragged to another corner whenever needed. For full-screen presentations, disable “Show pet in full-screen apps” in the context menu or quit the pet.

**Can I use it without knowing how to code?**

Yes. Install Node.js 22, download a release package for your operating system, and run its startup script. Packaged releases do not require compilation, and everyday interactions work with a mouse.

**Where is my token stored?**

The web token is stored in the current browser's `localStorage`. A token persisted through the CLI is stored in `~/.mcd-desktop-pet/config.json`. Business requests pass through the local server to the configured MCP endpoint. Clearing the web token field removes the browser's saved token; it does not remove the server's token. Keep real tokens, personal addresses, and order details out of commits, issues, and demo screenshots.

## Run from Source

Install **Node.js 22** and **pnpm 12.10.1** (as specified in `package.json`). To run the desktop pet, also install **Godot 4.x** and make sure `godot --version` works in your terminal. Godot is optional if you only need the web console.

Clone the repository and build the shared package and console:

```bash
git clone https://github.com/kv-chiu/mcd-desktop-pet.git
cd mcd-desktop-pet
pnpm install
pnpm --filter @mcd/shared build
pnpm build:web
```

In terminal A, start the local server from the repository root and leave it running:

```bash
pnpm dev:server
```

Open [http://localhost:3001](http://localhost:3001) and [configure your token](#configure-your-mcdonalds-mcp-token).

In terminal B, start the pet from the same repository root:

```bash
pnpm dev:desktop
```

For frontend development, run the Vite development server in terminal C and open [http://localhost:8080](http://localhost:8080). Keep the local server in terminal A running:

```bash
pnpm dev:web
```

To use the CLI from source, build it first, then inspect the available commands:

```bash
pnpm build:cli
pnpm cli --help
```

In source mode, replace `./mcd` in the CLI examples with `pnpm cli`.

### Simulated Demo

With **Python 3.10+** installed and both the local server and desktop pet running, execute this command from another terminal at the repository root:

```bash
pnpm mock:lunch
```

It demonstrates the six-step lunch scenario through local simulation endpoints. It requires no real token and does not call the official order creation API. Coupons, suggested meals, order numbers, delivery progress, and arrival messages are demo content. The regular lunch timer only triggers a reminder; it does not automatically claim coupons or place orders.

## Project Structure

```text
mcd-desktop-pet/
├── desktop/      # Godot 4.x desktop client, animations, and speech bubbles
├── server/       # Hono server, MCP gateway, REST API, and WebSocket hub
├── web/          # React 19 + Vite management console
├── shared/       # Shared protocols, types, and tool metadata (@mcd/shared)
├── cli/          # Command-line interface for users and AI agents
├── skill/        # Agent Skill and helper scripts
├── scripts/      # Release packaging and simulation scripts
└── .github/      # CI and release workflows
```

The web console and CLI call the local server over HTTP. The server handles MCP authentication, session headers, and tool calls, then sends pet actions and speech bubbles over WebSocket to the Godot client.

## Competition Materials

The project provides the following materials for the [Developer Innovation Challenge](https://github.com/M-China/mcd-developer-innovation-challenge) and its [full rules](https://github.com/M-China/mcd-developer-innovation-challenge/blob/main/activityGuidelines.md):

| File | Contents |
|:---|:---|
| [README.md](README.md) / [README.en.md](README.en.md) | Project overview, target users, installation, and usage examples in Chinese and English |
| [CONTEST_DECLARATION.md](CONTEST_DECLARATION.md) | Official competition declaration, preserved in its original form |
| [MCP_INTEGRATION.md](MCP_INTEGRATION.md) | MCP server, tools, request flow, business value, and verification instructions (Chinese) |
| [mcp-config.example.json](mcp-config.example.json) | Example MCP connection configuration with environment-variable placeholders for the endpoint and credentials |

## License

The project code is available under the [MIT License](LICENSE). Rights to McDonald's trademarks and related assets remain with their respective owners and are not transferred by the code license. Project output is for reference only and does not constitute medical, nutritional, or other professional advice. Food information, prices, and availability are subject to current results from official McDonald's channels.
