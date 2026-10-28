import { describe, expect, it } from "vitest";

// Every screen module must import without throwing (a broken import or top-level error would otherwise only show in the browser) and export a component.
const modules = import.meta.glob("../screens/**/*.{js,jsx}");

describe("screen modules", () => {
  it.each(Object.keys(modules))("imports %s", async (file) => {
    const mod = await modules[file]();
    expect(mod).toBeTruthy();
    if (/\.screen\.jsx$/.test(file)) expect(typeof mod.default).toBe("function");
  });
});
