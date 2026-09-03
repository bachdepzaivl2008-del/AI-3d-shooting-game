import { BrowserInputSource } from './BrowserInputSource.js'
import { TouchInputSource } from './TouchInputSource.js'
import { detectClientProfile } from '../device/clientProfile.js'

export function createAdaptiveInputSource(
  inputElement,
  config,
  sourceId = 'client:local-player'
) {
  const profile =
    detectClientProfile()

  if (profile.touchPrimary) {
    return {
      inputSource:
        new TouchInputSource(
          inputElement,
          config,
          sourceId
        ),
      profile,
    }
  }

  return {
    inputSource:
      new BrowserInputSource(
        inputElement,
        sourceId
      ),
    profile,
  }
}
