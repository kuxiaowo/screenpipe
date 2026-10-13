// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com
"use client";

import { useEffect, useRef } from "react";
import posthog from "posthog-js";
import { useSettings } from "@/lib/hooks/use-settings";
import { isPrimaryWindow } from "@/lib/utils/is-primary-window";
import bundled from "@/lib/i18n/generated.json";

export const LOCALIZATION_FLAG = "desktop-localization";
const localChineseAvailable = (bundled as { locales: string[] }).locales.includes("zh-CN");

/** Persist one resolved rollout decision for every webview and native surface. */
export function LocalizationRolloutSync({ ready }: { ready: boolean }) {
  const { settings, updateSettings, isSettingsLoaded } = useSettings();
  const current = useRef({ enabled: settings.uiLocalizationEnabled === true, updateSettings });
  current.current = { enabled: settings.uiLocalizationEnabled === true, updateSettings };

  useEffect(() => {
    if (!ready || !isSettingsLoaded || !isPrimaryWindow()) return;
    // The Chinese local distribution owns availability. Remote rollout flags
    // must not hide its offline language selector or revert its native menus.
    if (localChineseAvailable) {
      if (settings.uiLocalizationEnabled !== true) {
        void updateSettings({
          uiLocalizationEnabled: true,
          ...(settings.uiLocale === "system" ? { uiLocale: "zh-CN" } : {}),
        }).catch((error) => console.error("[localization] failed to enable bundled languages", error));
      }
      return;
    }
    let cancelled = false;
    let pending = Promise.resolve();
    const unsubscribe = posthog.onFeatureFlags((_keys, variants, context) => {
      // An unavailable response is not a revocation. Retain the last decision
      // offline; new installs and pre-rollout settings default to false.
      if (context?.errorsLoading) return;
      const enabled = variants[LOCALIZATION_FLAG] === true;
      pending = pending.then(async () => {
        if (cancelled || enabled === current.current.enabled) return;
        await current.current.updateSettings({ uiLocalizationEnabled: enabled });
        current.current.enabled = enabled;
      }).catch((error) => {
        console.error("[localization] failed to persist PostHog rollout decision", error);
      });
    });
    return () => { cancelled = true; unsubscribe(); };
  }, [ready, isSettingsLoaded]);
  return null;
}
