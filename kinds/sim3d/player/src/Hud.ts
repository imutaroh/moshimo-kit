// hud.json の frames[f] を、episode.json の hud の値どおりに描く。背景は透明。
// 描く順：上部の薄い影（topShade）→ black → 文字（FORMAT.md）
// コマごとに、HUD の箱の中身を HTML の文字列で作り直す（前のコマに頼らない）。
import { assetUrl, type HudFrame, type HudStyle } from "./data";

export const SANS = "EpisodeSans";
export const MONO = "EpisodeMono";
// 数字は Mono、Mono に無い日本語は Sans に落とす
const monoStack = `"${MONO}", "${SANS}"`;
const sansStack = `"${SANS}"`;
const EDGE = 24; // 名札・吹き出しを画面の端から離す最小の px（台本に値が無いので決めた）

// episode.json のフォントの道（assets/fonts/...）を、書き出し用のフォルダの道（fonts/...）に直す。
// 「assets/」は元のリポジトリの名残で、いまは shared/fonts を書き出し用のフォルダの fonts/ に置いている（kinds/sim3d/lib/hud-defaults.json）
export const fontUrl = (repoPath: string) => {
  const prefix = "assets/";
  if (!repoPath.startsWith(prefix)) throw new Error(`フォントは ${prefix} の下に置く: ${repoPath}`);
  return assetUrl(repoPath.slice(prefix.length));
};

export const loadFonts = async (hud: HudStyle) => {
  const faces = [new FontFace(SANS, `url(${fontUrl(hud.fontSans)})`), new FontFace(MONO, `url(${fontUrl(hud.fontMono)})`)];
  for (const f of await Promise.all(faces.map((x) => x.load()))) document.fonts.add(f);
};

// 札の幅を測る（左右のはみ出しを内側へ寄せるため）。フォントは読み込み済みの前提
let measureCtx: CanvasRenderingContext2D | null = null;
const textWidth = (text: string, px: number, family: string) => {
  measureCtx ??= document.createElement("canvas").getContext("2d");
  measureCtx!.font = `${px}px ${family}`;
  return measureCtx!.measureText(text).width;
};

// ---------- HTML の組み立て ----------
type Style = Record<string, string | number | undefined>;
// 単位を付けない CSS の値（数のときも px を付けない）
const UNITLESS = new Set(["opacity", "lineHeight", "zIndex", "fontWeight", "flex"]);
const css = (st: Style) =>
  Object.entries(st)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}:${typeof v === "number" && !UNITLESS.has(k) ? `${v}px` : v}`)
    .join(";");
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const div = (st: Style, inner = "") => `<div style="${esc(css(st))}">${inner}</div>`;
const span = (st: Style | null, text: string) => (st ? `<span style="${esc(css(st))}">${esc(text)}</span>` : `<span>${esc(text)}</span>`);

const base: Style = { position: "absolute", lineHeight: 1, whiteSpace: "pre", margin: 0 };
const fill: Style = { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" };

export const createHud = (el: HTMLElement, s: HudStyle, frames: HudFrame[], screenW: number) => ({
  draw(f: number) {
    el.innerHTML = hudHtml(s, frames[Math.min(Math.max(f, 0), frames.length - 1)], screenW);
  },
});

const hudHtml = (s: HudStyle, d: HudFrame, screenW: number) => {
  const shadow = `0 ${s.shadow.offsetY}px ${s.shadow.blurPx}px ${s.shadow.color}`;
  const white: Style = { color: s.text, textShadow: shadow };
  const shadeA = Math.max(d.main?.a ?? 0, d.clock?.a ?? 0, d.title?.a ?? 0);
  const out: string[] = [];

  if (d.main || d.clock || d.title)
    out.push(
      div({ position: "absolute", left: 0, top: 0, width: "100%", height: s.topShade.height, opacity: shadeA, background: `linear-gradient(to bottom, ${s.topShade.color}, rgba(0,0,0,0))` }),
    );
  if (d.black) out.push(div({ ...fill, background: `rgba(0,0,0,${d.black})` }));

  if (d.title) out.push(title(s, d.title, white));

  if (d.clock)
    out.push(
      div(
        { position: "absolute", left: s.clock.centerX, top: s.clock.y, transform: "translateX(-50%)", opacity: d.clock.a, textAlign: "center" },
        div({ ...base, position: "relative", fontSize: s.clock.labelPx, ...white }, esc(d.clock.label)) +
          div({ ...base, position: "relative", marginTop: s.clock.gap, fontSize: s.clock.textPx, fontFamily: monoStack, ...white }, esc(d.clock.text)),
      ),
    );

  if (d.main) out.push(main(s, d.main, white));

  if (d.pill)
    out.push(
      div(
        {
          ...base,
          left: s.pill.x,
          top: s.pill.y,
          opacity: d.pill.a,
          fontSize: s.pill.fontPx,
          ...white,
          background: s.panel,
          padding: `${s.pill.paddingY}px ${s.pill.paddingX}px`,
          borderRadius: s.pill.radius,
        },
        esc(d.pill.text),
      ),
    );

  if (d.caption)
    out.push(
      div(
        {
          ...base,
          left: s.caption.centerX,
          top: s.caption.centerY,
          transform: "translate(-50%, -50%)",
          opacity: d.caption.a,
          fontSize: s.caption.fontPx,
          lineHeight: s.caption.lineHeight,
          textAlign: "center",
          ...white,
          background: s.panel,
          padding: `${s.caption.paddingY}px ${s.caption.paddingX}px`,
          borderRadius: s.caption.radius,
        },
        esc(d.caption.lines.join("\n")),
      ),
    );

  for (const t of d.tags ?? []) out.push(pointer(t.x, t.y, t.a, t.text, s.tag, s.panel, white, s.panel, screenW));
  for (const b of d.bubbles ?? []) out.push(pointer(b.x, b.y, b.a, b.text, s.bubble, s.text, { color: s.ink }, s.text, screenW));

  if (d.card)
    out.push(
      div(
        { position: "absolute", left: s.card.centerX, top: s.card.centerY, transform: "translate(-50%, -50%)", opacity: d.card.a, textAlign: "center" },
        div({ ...base, position: "relative", fontSize: s.card.fontPx, lineHeight: s.card.lineHeight, ...white }, esc(d.card.lines.join("\n"))) +
          (d.card.small?.length
            ? div(
                {
                  ...base,
                  position: "relative",
                  marginTop: s.card.smallGap,
                  fontSize: s.card.smallPx,
                  lineHeight: s.card.smallLineHeight,
                  color: s.card.smallColor,
                  textShadow: shadow,
                },
                esc(d.card.small.join("\n")),
              )
            : ""),
      ),
    );

  if (d.note)
    out.push(
      div(
        {
          ...base,
          left: s.noteText.centerX,
          top: s.noteText.y,
          transform: "translateX(-50%)",
          opacity: d.note.a,
          fontSize: s.noteText.fontPx,
          color: s.noteText.color,
          textShadow: shadow,
          textAlign: "center",
        },
        esc(d.note.text),
      ),
    );

  return div({ ...fill, pointerEvents: "none", fontFamily: sansStack }, out.join(""));
};

const title = (s: HudStyle, d: NonNullable<HudFrame["title"]>, white: Style) => {
  const t = s.title;
  // 1行目の文字の箱（行の高さ1）の上端を y に合わせる
  const top = t.y - ((t.lineHeight - 1) / 2) * t.fontPx;
  const lines = d.lines
    .map((line) => div({ ...base, position: "relative", fontSize: t.fontPx, lineHeight: t.lineHeight, ...white }, line.map((c) => span(c.accent ? { color: s.accent } : null, c.t)).join("")))
    .join("");
  const sub = d.sub ? div({ ...base, position: "relative", marginTop: t.sub.gap - ((t.lineHeight - 1) / 2) * t.fontPx, fontSize: t.sub.fontPx, ...white }, esc(d.sub)) : "";
  return div({ position: "absolute", left: t.centerX, top, transform: "translateX(-50%)", opacity: d.a, textAlign: "center" }, lines + sub);
};

const main = (s: HudStyle, d: NonNullable<HudFrame["main"]>, white: Style) => {
  const m = s.main;
  const row = (y: number): Style => ({ position: "absolute", left: m.x, top: y, display: "flex", alignItems: "baseline", whiteSpace: "pre" });
  const inner = [
    div(
      {
        ...base,
        left: m.x,
        top: m.tag.y,
        fontSize: m.tag.fontPx,
        ...white,
        background: s.panel,
        padding: `${m.tag.paddingY}px ${m.tag.paddingX}px`,
        borderRadius: m.tag.radius,
      },
      esc(m.tag.text),
    ),
    div(
      row(m.count.y),
      span({ fontSize: m.count.fontPx, lineHeight: 1, fontFamily: monoStack, ...white }, d.count) +
        span({ fontSize: m.count.unitPx, lineHeight: 1, marginLeft: m.count.unitGap, ...white }, d.countUnit),
    ),
    div({ ...base, left: m.x, top: m.label.y, fontSize: m.label.fontPx, ...white }, esc(d.label)),
    div(
      row(m.value.y),
      span({ fontSize: m.value.fontPx, lineHeight: 1, fontFamily: monoStack, ...white }, d.value) +
        span({ fontSize: m.value.unitPx, lineHeight: 1, marginLeft: m.value.unitGap, ...white }, d.unit),
    ),
  ];
  if (d.badge)
    // 外側で右端を rightX に合わせ、内側を中心から badgeScale 倍する
    inner.push(
      div(
        { position: "absolute", left: m.badge.rightX, top: m.badge.y, transform: "translateX(-100%)" },
        div(
          {
            ...base,
            position: "relative",
            fontSize: m.badge.fontPx,
            fontFamily: monoStack,
            color: s.ink,
            background: s.accent,
            padding: `${m.badge.paddingY}px ${m.badge.paddingX}px`,
            borderRadius: m.badge.radius,
            transform: `scale(${d.badgeScale})`,
            transformOrigin: "center",
          },
          esc(d.badge),
        ),
      ),
    );
  return div({ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: d.a }, inner.join(""));
};

// 名札・吹き出し：(x,y) が指している点。そこから上へ線をのばし、その上に札を中央揃えで乗せる。はみ出すときは札だけ内側へ
const pointer = (
  x: number,
  y: number,
  a: number,
  text: string,
  box: { fontPx: number; stemPx: number; paddingX: number; paddingY: number; radius: number },
  bg: string,
  textStyle: Style,
  stemColor: string,
  screenW: number,
) => {
  const w = textWidth(text, box.fontPx, sansStack) + box.paddingX * 2;
  const left = Math.min(Math.max(x - w / 2, EDGE), Math.max(EDGE, screenW - EDGE - w));
  const STEM_W = 3;
  return div(
    { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: a },
    div({ position: "absolute", left: x - STEM_W / 2, top: y - box.stemPx, width: STEM_W, height: box.stemPx, background: stemColor }) +
      div(
        {
          ...base,
          left,
          top: y - box.stemPx,
          transform: "translateY(-100%)",
          fontSize: box.fontPx,
          ...textStyle,
          background: bg,
          padding: `${box.paddingY}px ${box.paddingX}px`,
          borderRadius: box.radius,
        },
        esc(text),
      ),
  );
};
