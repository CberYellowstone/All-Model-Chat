import type { AppSettings, ChatSettings } from '@/types';

type ThirdPartyApiActiveSettings = Pick<AppSettings, 'apiMode' | 'isThirdPartyApiEnabled'>;

type AnySettingsWithApiMode =
  | ThirdPartyApiActiveSettings
  | ChatSettings
  | (ChatSettings & { isThirdPartyApiEnabled?: boolean });

export const isThirdPartyApiActive = (settings: AnySettingsWithApiMode): boolean => {
  const apiMode = 'apiMode' in settings ? settings.apiMode : 'gemini-native';
  const isThirdPartyEnabled = 'isThirdPartyApiEnabled' in settings ? settings.isThirdPartyApiEnabled === true : true; // fallback if no flag
  return isThirdPartyEnabled && apiMode === 'third-party';
};
