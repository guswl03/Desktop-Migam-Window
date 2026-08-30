import type { ResourceResponseMode, Settings } from "./contracts";
import { settingsHelp } from "./settings-help";

export function renderPetSettingsControls(
  settings: Settings["pet"],
  developmentTestMarkup: string,
): string {
  return `
    <label><span class="setting-label-text">컴퓨터 상태에 따른 펫 반응 ${settingsHelp("resourceResponse")}</span>
      <select name="resourceResponseMode">
        <option value="off" ${settings.resourceResponseMode === "off" ? "selected" : ""}>사용 안 함</option>
        <option value="cpu" ${settings.resourceResponseMode === "cpu" ? "selected" : ""}>CPU 사용량</option>
        <option value="memory" ${settings.resourceResponseMode === "memory" ? "selected" : ""}>메모리 사용량</option>
        <option value="combined" ${settings.resourceResponseMode === "combined" ? "selected" : ""}>CPU와 메모리 중 높은 값</option>
      </select>
    </label>
    <p id="resource-status" class="detection-status" role="status">CPU --% · 메모리 --%</p>
    <label class="checkbox-row"><input name="automaticPhotoDeliveryEnabled" type="checkbox" ${settings.automaticPhotoDeliveryEnabled ? "checked" : ""} /> <span class="setting-label-text">자동 사진 배달 ${settingsHelp("automaticPhotoDelivery")}</span></label>
    <label class="checkbox-row"><input name="windowClimbingEnabled" type="checkbox" ${settings.windowClimbingEnabled ? "checked" : ""} /> <span class="setting-label-text">창 위로 올라가기 ${settingsHelp("windowClimbing")}</span></label>
    ${developmentTestMarkup}
  `;
}

export function readPetSettings(
  values: FormData,
  current: Settings["pet"],
): Settings["pet"] {
  return {
    visualScalePercent: current.visualScalePercent,
    resourceResponseMode: String(values.get("resourceResponseMode")) as ResourceResponseMode,
    automaticPhotoDeliveryEnabled: values.has("automaticPhotoDeliveryEnabled"),
    windowClimbingEnabled: values.has("windowClimbingEnabled"),
  };
}
