# UKY Centralised Retail Management System

A working React prototype for Uni Kwong Yuen’s centralised retail operations. Built with Vite, Tailwind CSS, Lucide React, and Recharts. Mock data is shared across modules and changes persist in this browser’s local storage.

## Live Demo

Explore the prototype hosted on Vercel: **[Open UKY Retail Workspace](https://baim-assign.vercel.app/)**.

The demo starts with the Administrator profile. Use **Explore the demo** in the sidebar to try the sales, replenishment, and cross-store refund workflows. Changes are saved locally in your browser.

## Standalone HTML submission

Open **[UKY_Retail_Management.html](UKY_Retail_Management.html)** in Chrome or Edge by double-clicking the downloaded file. Download the actual file from GitHub using **Download raw file**. No server, Node.js installation, or internet connection is needed to use it. JavaScript must be enabled.

This single HTML file contains the existing React application, styles, icons, charts, product images, and fonts. All five demo roles and the sale, replenishment, and cross-store refund workflows remain interactive. Submit or share this file on its own; the source folders are not needed to run it.

Records are saved in the browser on this device. Keep using the same browser and file location to retain demo records; local-file storage behaviour varies by browser, and moving the file or clearing browser data may create a fresh workspace. The offline copy and Vercel website have separate local data.

After editing the source application, regenerate the HTML with:

```sh
npm run build:html
```

The export uses the bundled images and fonts in `scripts/html-assets/`, so rebuilding requires no asset downloads once npm dependencies are installed. The normal Vite/Vercel build remains available through `npm run build`.

## Start

Use Node.js 22 LTS and npm. No API keys or environment variables are required.

```sh
git clone https://github.com/zhangchuman1029-debug/baim-assign.git
cd baim-assign
npm ci
npm run dev
```

Open http://localhost:5173. `npm run build` creates a production build; `npm test` verifies the business workflows.

## Demonstration guide

The initial session is **Alex Chan / System Administrator**. Click the profile at the top right to open the **Prototype / demo role switcher**, select any of the five roles, and assign its store. Sales Staff land directly in POS; all other roles land in their own dashboard. Switching roles never resets shared business records. Role simulation is intended for demonstration, not authentication or production security.

1. **Sale:** Open POS / Sales, choose a store, add items, and complete a mock checkout. The receipt preserves original prices. Sales history, stock movements, and reports update immediately.
2. **Replenishment:** Create a request for a product/store without another active request. Submit it again to see duplicate detection. Open Manage, then Approve → Start processing → Dispatch stock → Confirm receipt. Dispatch deducts warehouse inventory; receipt adds store inventory. Try these stages using Head Office Manager, Warehouse Staff, and Store Manager profiles, or complete all as Administrator.
3. **Cross-store refund:** Open New refund, search a transaction from another store, enter item quantities and conditions, and choose the receiving store. Submit for approval, then approve as a manager. Resellable units return to the receiving store; damaged units are excluded from sellable stock. Pending refunds reserve quantities to prevent duplicate/excessive requests.

Use **Explore the demo** in the sidebar for guidance inside the app. Seeded sales cover the 30 days ending **13 November 2026**, the demonstration reporting date. The three initial replenishment requests demonstrate Pending, Approved, and Dispatched states. Inventory is an opening snapshot after historical sales; every new business action creates an explicit movement.

## Modules

Dashboard, Product management, POS / Sales, Sales history, Inventory, Replenishment, Refunds, six Management reports, User management, and Settings. Search, filters, pagination, CSV exports, receipts, stock adjustment, team editing, settings, global search, notifications, and role switching are functional.

## Data and permissions

Shared state and persistence live in `src/store.jsx`; pure, atomic business actions and role checks live in `src/domain.js`. A failed action cannot partially change inventory. No real payment gateway, authentication server, ERP, or remote data storage is implemented. User accounts and roles are local demonstration records. CSV exports mitigate spreadsheet formula injection.

To restart the demonstration, clear the `uky-workspace-v1` browser local-storage entry and reload. Settings can export a JSON backup of the current workspace. The hosted version loads product images and optional fonts from Unsplash and Google Fonts; the standalone HTML embeds these assets for offline use.

## Technology stack

- React 19 and Vite 6
- Tailwind CSS 4 with custom responsive styles
- Lucide React icons and Recharts visualisations
- Browser local storage for business records and session storage for the demonstration profile
- Node.js built-in test runner

## Role access

| Role | Access |
| --- | --- |
| System Administrator | Administration dashboard, all modules and actions, user roles, system settings, and manager refund approval configuration. |
| Head Office Manager | All-store dashboard, operational modules, reports, catalogue/pricing management, replenishment and refund approvals. |
| Store Manager | Local dashboard, assigned-store sales, inventory adjustments, replenishment requests/receipts, refunds, and reports. Refund approval follows administrator configuration. |
| Sales Staff | POS first, local daily sales dashboard/history, product search in POS, cross-store refund lookup, and refund submission. No management approvals or settings. |
| Warehouse Staff | Warehouse stock/dispatch dashboard, warehouse inventory adjustments, approved replenishment picking and dispatch. No POS, refunds, or settings. |

Head office approves replenishment requests, warehouse staff process and dispatch them, and the receiving store manager confirms delivery. Pending refunds reserve quantities; rejection releases them. Approved refunds use historical sale prices and only return resellable items to stock. Permissions are enforced in navigation, direct URL routing, shared-state selectors, and business action handlers. Store teams receive only assigned-store sales, inventory, movements, requests, returns, and activity. Warehouse staff receive warehouse inventory and approved transfer stages. Refund lookup deliberately searches receipts across stores without adding them to local sales history; refundable quantities are calculated against all pending and approved returns.

Only the System Administrator can change **Settings → Store manager refund approval**. It defaults to enabled for existing browser data; disabling it hides manager approval controls and blocks direct approval attempts, while head office retains approval access. Switching roles or locations closes open work and pending delayed checkout actions cannot execute with an old role.

## Project structure

```text
src/
├── App.jsx             # Shell, navigation, profile switching, and global search
├── Dashboard.jsx       # Dashboard and shared reporting metrics
├── Commerce.jsx        # Products, POS, and sales history
├── Operations.jsx      # Inventory, replenishment, and refunds
├── Administration.jsx  # Reports, users, and settings
├── components.jsx      # Reusable UI components
├── data.js             # Seed data, locations, roles, and module permissions
├── domain.js           # Atomic business actions, validation, and permission checks
├── domain.test.js      # Business-rule tests
├── permissions.js      # Role/action permissions, routing, scoped data, refund lookup
├── permissions.test.js # Access boundaries and cross-role workflow tests
├── RoleWorkspaces.jsx  # Administrator, sales, warehouse, and operational priorities
├── store.jsx           # Shared state, persistence, notifications, and CSV exports
├── main.jsx            # React entry point
└── styles.css          # Visual system and responsive layouts
```

## Validation

```sh
npm test
npm run build
npm run preview
```

The 20 automated tests cover scoped data, unauthorised direct routes/actions, configured refund approvals, cross-role workflow continuity, sales, historical prices, insufficient-stock rollback, permissions, duplicate requests, replenishment stock conservation, cross-store refunds, damaged returns, reserved refund quantities, unique product codes, serialisation, and Hong Kong reporting dates. The production build is generated in `dist/`; `npm run preview` serves that build locally.

## Prototype limitations

- Role switching is a demonstration feature, not secure authentication.
- Data is local to the browser and origin, with no synchronisation between devices, browsers, or tabs.
- New actions use the current timestamp, while reporting periods remain anchored to the fixed demonstration date of 13 November 2026.
- JSON backup export is supported; backup import is not implemented.
- To restore the default profile, remove the `uky-session` session-storage entry and reload.
- Real payments, a shared database, ERP integration, and production deployment configuration are outside this prototype's scope.
