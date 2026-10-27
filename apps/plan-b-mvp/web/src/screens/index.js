// Registry of native React screens. A screen listed here replaces the legacy SCREENS[name]() HTML for that route.
//
// To add a screen: create `src/screens/<name>.screen.jsx` whose default export is the component. That is all: the file name before
// `.screen.` is the route name (home, journey, results, next, panic, nav, dashboard, rides, weather, offline-area, terms, privacy,
// sources), and it is picked up automatically, so parallel work never touches this file. A component may also set
// `Component.screenName = "dashboard"` to override the file name.
const modules = import.meta.glob("./*.screen.{js,jsx}", { eager: true });

export const screens = {};
for (const [file, mod] of Object.entries(modules)) {
  const name = mod.default?.screenName || file.match(/\/([^/]+)\.screen\.jsx?$/)[1];
  screens[name] = mod.default;
}
