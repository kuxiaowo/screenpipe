// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

import React, { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useGT } from "gt-react";

const mocks = vi.hoisted(() => ({ settings: vi.fn(), writes: vi.fn(), flags: vi.fn() }));
vi.mock("@/lib/hooks/use-settings", () => ({ useSettings: () => mocks.settings() }));
vi.mock("@/lib/utils/is-primary-window", () => ({ isPrimaryWindow: () => true }));
vi.mock("@tauri-apps/plugin-os", () => ({ locale: async () => "zh-CN" }));
vi.mock("posthog-js", () => ({ default: { onFeatureFlags: mocks.flags } }));
vi.mock("@/lib/i18n/generated.json", async () => {
  const { hashMessage } = await import("gt-i18n/internal");
  return { default: {
    defaultLocale: "en", locales: ["zh-CN"], mode: "cached", revision: "chinese-test",
    translations: { "zh-CN": { [hashMessage("Settings", { $format: "ICU" })]: "设置" } },
    coverage: {}, fallbacks: {}, causes: [],
  } };
});
import { LocalizationProvider } from "./provider";
import { LocalizationRolloutSync } from "./rollout-sync";

function Content() {
  const gt = useGT();
  const { updateSettings } = mocks.settings();
  const [draft, setDraft] = useState("");
  return <><h1>{gt("Settings")}</h1><input aria-label="Draft" value={draft} onChange={event => setDraft(event.target.value)} />
    <button onClick={() => updateSettings({ uiLocale: "en" })}>English</button>
    <button onClick={() => updateSettings({ uiLocale: "zh-CN" })}>中文</button></>;
}
function App() {
  const [settings, setSettings] = useState({ uiLocale: "system", uiLocalizationEnabled: false });
  mocks.settings.mockReturnValue({ settings, isSettingsLoaded: true, updateSettings: async (patch: Partial<typeof settings>) => {
    mocks.writes(patch);
    setSettings(current => ({ ...current, ...patch }));
  } });
  return <><LocalizationRolloutSync ready /><LocalizationProvider><Content /></LocalizationProvider></>;
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });
test("bundled Chinese activates offline and switches to English without losing user text", async () => {
  const fetch = vi.fn(() => { throw new Error("No localization network requests allowed"); });
  vi.stubGlobal("fetch", fetch);
  vi.spyOn(console, "info").mockImplementation(() => {});
  render(<App />);
  expect(await screen.findByRole("heading", { name: "设置" })).toBeVisible();
  await waitFor(() => expect(mocks.writes).toHaveBeenCalledWith({ uiLocale: "zh-CN", uiLocalizationEnabled: true }));
  fireEvent.change(screen.getByRole("textbox", { name: "Draft" }), { target: { value: "private English draft" } });
  fireEvent.click(screen.getByRole("button", { name: "English" }));
  expect(await screen.findByRole("heading", { name: "Settings" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "中文" }));
  expect(await screen.findByRole("heading", { name: "设置" })).toBeVisible();
  expect(screen.getByRole("textbox", { name: "Draft" })).toHaveValue("private English draft");
  expect(mocks.flags).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
