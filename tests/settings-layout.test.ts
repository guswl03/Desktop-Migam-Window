import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

function renderNarrowSettingsLayout(): string {
  const fixtureDirectory = mkdtempSync(join(tmpdir(), "migam-settings-layout-"));
  const fixturePath = join(fixtureDirectory, "settings.html");
  const profilePath = join(fixtureDirectory, "edge-profile");
  const html = `<!doctype html>
    <html>
      <head><meta charset="utf-8"><style>${styles}</style></head>
      <body data-window="settings">
        <main class="panel settings-panel">
          <section class="debug-document">
            <div class="debug-pane-title"><span>MigamDesktop.Settings</span><span>×</span></div>
            <div class="debug-command-line"><span>0:000&gt;</span><span>.settings /local /schema:2</span></div>
            <div class="settings-heading">
              <div><p class="eyebrow">MIGAM DESKTOP CONFIGURATION</p><h1>설정</h1></div>
              <span class="debug-build">LOCAL · SCHEMA 2</span>
            </div>
            <p class="warning">긴급 중지 단축키를 등록하지 못했습니다.</p>
            <form>
              <fieldset>
                <legend>펫</legend>
                <label>컴퓨터 상태에 따른 펫 반응<select><option>사용 안 함</option></select></label>
                <p class="detection-status">CPU 30% · 메모리 89%</p>
                <label class="checkbox-row"><input type="checkbox">자동 사진 배달</label>
              </fieldset>
              <fieldset><legend>뽀모도로</legend><label>집중 시간 (분)<input type="number" value="1"></label><label>짧은 휴식 (분)<input type="number" value="5"></label></fieldset>
            </form>
          </section>
          <div class="debug-statusbar"><span>Configuration ready</span><span>Ctrl+Shift+F12 · EMERGENCY STOP</span></div>
        </main>
        <script>
          const title = document.querySelector('.settings-heading > div').getBoundingClientRect();
          const build = document.querySelector('.debug-build').getBoundingClientRect();
          const overlaps = title.bottom > build.top;
          document.documentElement.dataset.headingOverlap = String(overlaps);
          document.documentElement.dataset.horizontalOverflow = String(document.documentElement.scrollWidth > document.documentElement.clientWidth);
          const pomodoroLabels = document.querySelectorAll('fieldset:nth-of-type(2) label');
          const firstField = pomodoroLabels[0].getBoundingClientRect();
          const secondField = pomodoroLabels[1].getBoundingClientRect();
          document.documentElement.dataset.singleColumn = String(secondField.top >= firstField.bottom);
        </script>
      </body>
    </html>`;

  writeFileSync(fixturePath, html, "utf8");
  try {
    return execFileSync(edgePath, [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      `--user-data-dir=${profilePath}`,
      "--window-size=520,780",
      "--dump-dom",
      pathToFileURL(fixturePath).href,
    ], { encoding: "utf8", maxBuffer: 2_000_000, stdio: ["ignore", "pipe", "ignore"] });
  } finally {
    rmSync(fixtureDirectory, { recursive: true, force: true });
  }
}

describe("settings debugger layout", () => {
  it("keeps the command line flush with the document edges", () => {
    expect(styles).toMatch(
      /\.settings-panel \.debug-document > \.debug-command-line\s*\{[^}]*margin-right:\s*0;[^}]*margin-left:\s*0;/s,
    );
  });

  const browserTest = existsSync(edgePath) ? it : it.skip;

  browserTest(
    "stacks the narrow heading without overlap or horizontal overflow",
    () => {
      const rendered = renderNarrowSettingsLayout();

      expect(rendered).toContain('data-heading-overlap="false"');
      expect(rendered).toContain('data-horizontal-overflow="false"');
      expect(rendered).toContain('data-single-column="true"');
    },
    15_000,
  );
});
