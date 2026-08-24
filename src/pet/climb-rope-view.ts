import { listen } from "@tauri-apps/api/event";

interface ClimbRopeState {
  progress: number;
  side: "left" | "right";
}

const clamp01 = (value: number): number => Math.min(Math.max(value, 0), 1);
const mix = (from: number, to: number, progress: number): number =>
  from + (to - from) * progress;

export function mountClimbRope(root: HTMLElement): void {
  const stage = document.createElement("main");
  stage.className = "climb-rope-stage";
  stage.setAttribute("aria-hidden", "true");
  stage.innerHTML = `
    <svg class="climb-rope-svg" xmlns="http://www.w3.org/2000/svg">
      <path class="climb-rope-shadow" />
      <path class="climb-rope-stroke" />
      <g class="climb-rope-hook">
        <path d="M 0 8 L 0 1 C 0 -5, 8 -7, 9 -2 C 10 2, 6 5, 2 3" />
      </g>
    </svg>
  `;
  root.replaceChildren(stage);

  const svg = stage.querySelector<SVGSVGElement>(".climb-rope-svg")!;
  const stroke = stage.querySelector<SVGPathElement>(".climb-rope-stroke")!;
  const shadow = stage.querySelector<SVGPathElement>(".climb-rope-shadow")!;
  const hook = stage.querySelector<SVGGElement>(".climb-rope-hook")!;
  let latestState: ClimbRopeState = { progress: 1, side: "right" };

  const render = ({ progress, side }: ClimbRopeState): void => {
    latestState = { progress, side };
    const width = Math.max(window.innerWidth, 176);
    const height = Math.max(window.innerHeight, 24);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    const direction = side === "right" ? 1 : -1;
    const ropeX = side === "right" ? width - 42 : 42;
    const hookAnchorX = side === "right" ? width - 2 : 2;
    const handX = ropeX - direction * 72;
    const topY = 10;
    const handY = height - 1;
    const p = clamp01(progress);
    let path: string;
    let hookX: number;
    let hookY: number;
    let hookRotation: number;

    if (p < 0.78) {
      const flight = p / 0.78;
      hookX = mix(handX, hookAnchorX, flight);
      hookY = mix(handY - 8, topY, flight);
      const arc = Math.sin(Math.PI * flight);
      const controlX = mix(handX, hookAnchorX, flight * 0.52) - direction * 38 * arc;
      const controlY = mix(handY, topY, flight * 0.48) - 78 * arc;
      path = `M ${handX} ${handY} Q ${controlX} ${controlY} ${hookX} ${hookY}`;
      hookRotation = direction * mix(-55, 35, flight) + 220 * flight;
    } else {
      const tighten = (p - 0.78) / 0.22;
      const bottomX = mix(handX, ropeX, tighten);
      const controlX = mix((handX + ropeX) / 2, ropeX, tighten);
      path = `M ${bottomX} ${handY} Q ${controlX} ${height * 0.48} ${ropeX} ${topY + 9} Q ${ropeX} ${topY} ${hookAnchorX} ${topY}`;
      hookX = hookAnchorX;
      hookY = topY;
      hookRotation = direction * mix(35, 0, tighten);
    }

    stroke.setAttribute("d", path);
    shadow.setAttribute("d", path);
    hook.setAttribute(
      "transform",
      `translate(${hookX} ${hookY}) rotate(${hookRotation}) scale(${direction} 1)`,
    );
  };

  const renderAfterResize = (): void => {
    requestAnimationFrame(() => render(latestState));
  };
  window.addEventListener("resize", renderAfterResize);
  render(latestState);
  void listen<ClimbRopeState>("climb-rope://state", ({ payload }) => {
    render(payload);
    requestAnimationFrame(() => requestAnimationFrame(() => render(payload)));
  }).then((unlisten) => {
    window.addEventListener("pagehide", () => {
      window.removeEventListener("resize", renderAfterResize);
      unlisten();
    }, { once: true });
  });
}
