// hud.json の frames[f] を、episode.json の hud の値どおりに描く。背景は透明。
// 描く順：上部の薄い影（topShade）→ black → 文字（FORMAT.md）
import React from "react";
import { AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { HudFrame, HudStyle } from "./data";

export const SANS = "EpisodeSans";
export const MONO = "EpisodeMono";
// 数字は Mono、Mono に無い日本語は Sans に落とす
const monoStack = `"${MONO}", "${SANS}"`;
const sansStack = `"${SANS}"`;
const EDGE = 24; // 名札・吹き出しを画面の端から離す最小の px（台本に値が無いので決めた）

// episode.json のフォントの道（assets/fonts/...）を publicDir の道（fonts/...）に直す。
// 「assets/」は元のリポジトリの名残で、いまは shared/fonts を publicDir の fonts/ に置いている（kinds/sim3d/lib/hud-defaults.json）
export const fontUrl = (repoPath: string) => {
  const prefix = "assets/";
  if (!repoPath.startsWith(prefix)) throw new Error(`フォントは ${prefix} の下に置く: ${repoPath}`);
  return staticFile(repoPath.slice(prefix.length));
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

const base: React.CSSProperties = { position: "absolute", lineHeight: 1, whiteSpace: "pre", margin: 0 };

export const Hud: React.FC<{ s: HudStyle; frames: HudFrame[] }> = ({ s, frames }) => {
  const f = useCurrentFrame();
  const d = frames[Math.min(Math.max(f, 0), frames.length - 1)];
  const shadow = `0 ${s.shadow.offsetY}px ${s.shadow.blurPx}px ${s.shadow.color}`;
  const white: React.CSSProperties = { color: s.text, textShadow: shadow };
  const shadeA = Math.max(d.main?.a ?? 0, d.clock?.a ?? 0, d.title?.a ?? 0);

  return (
    <AbsoluteFill style={{ pointerEvents: "none", fontFamily: sansStack }}>
      {d.main || d.clock || d.title ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: s.topShade.height,
            opacity: shadeA,
            background: `linear-gradient(to bottom, ${s.topShade.color}, rgba(0,0,0,0))`,
          }}
        />
      ) : null}
      {d.black ? <AbsoluteFill style={{ background: `rgba(0,0,0,${d.black})` }} /> : null}

      {d.title ? <Title s={s} d={d.title} white={white} /> : null}

      {d.clock ? (
        <div style={{ position: "absolute", left: s.clock.centerX, top: s.clock.y, transform: "translateX(-50%)", opacity: d.clock.a, textAlign: "center" }}>
          <div style={{ ...base, position: "relative", fontSize: s.clock.labelPx, ...white }}>{d.clock.label}</div>
          <div style={{ ...base, position: "relative", marginTop: s.clock.gap, fontSize: s.clock.textPx, fontFamily: monoStack, ...white }}>
            {d.clock.text}
          </div>
        </div>
      ) : null}

      {d.main ? <Main s={s} d={d.main} white={white} /> : null}

      {d.pill ? (
        <div
          style={{
            ...base,
            left: s.pill.x,
            top: s.pill.y,
            opacity: d.pill.a,
            fontSize: s.pill.fontPx,
            ...white,
            background: s.panel,
            padding: `${s.pill.paddingY}px ${s.pill.paddingX}px`,
            borderRadius: s.pill.radius,
          }}
        >
          {d.pill.text}
        </div>
      ) : null}

      {d.caption ? (
        <div
          style={{
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
          }}
        >
          {d.caption.lines.join("\n")}
        </div>
      ) : null}

      {(d.tags ?? []).map((t, i) => (
        <Pointer key={`t${i}`} x={t.x} y={t.y} a={t.a} text={t.text} box={s.tag} bg={s.panel} textStyle={white} stemColor={s.panel} />
      ))}
      {(d.bubbles ?? []).map((b, i) => (
        <Pointer key={`b${i}`} x={b.x} y={b.y} a={b.a} text={b.text} box={s.bubble} bg={s.text} textStyle={{ color: s.ink }} stemColor={s.text} />
      ))}

      {d.card ? (
        <div
          style={{
            position: "absolute",
            left: s.card.centerX,
            top: s.card.centerY,
            transform: "translate(-50%, -50%)",
            opacity: d.card.a,
            textAlign: "center",
          }}
        >
          <div style={{ ...base, position: "relative", fontSize: s.card.fontPx, lineHeight: s.card.lineHeight, ...white }}>{d.card.lines.join("\n")}</div>
          {d.card.small?.length ? (
            <div
              style={{
                ...base,
                position: "relative",
                marginTop: s.card.smallGap,
                fontSize: s.card.smallPx,
                lineHeight: s.card.smallLineHeight,
                color: s.card.smallColor,
                textShadow: shadow,
              }}
            >
              {d.card.small.join("\n")}
            </div>
          ) : null}
        </div>
      ) : null}

      {d.note ? (
        <div
          style={{
            ...base,
            left: s.noteText.centerX,
            top: s.noteText.y,
            transform: "translateX(-50%)",
            opacity: d.note.a,
            fontSize: s.noteText.fontPx,
            color: s.noteText.color,
            textShadow: shadow,
            textAlign: "center",
          }}
        >
          {d.note.text}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const Title: React.FC<{ s: HudStyle; d: NonNullable<HudFrame["title"]>; white: React.CSSProperties }> = ({ s, d, white }) => {
  const t = s.title;
  // 1行目の文字の箱（行の高さ1）の上端を y に合わせる
  const top = t.y - ((t.lineHeight - 1) / 2) * t.fontPx;
  return (
    <div style={{ position: "absolute", left: t.centerX, top, transform: "translateX(-50%)", opacity: d.a, textAlign: "center" }}>
      {d.lines.map((line, i) => (
        <div key={i} style={{ ...base, position: "relative", fontSize: t.fontPx, lineHeight: t.lineHeight, ...white }}>
          {line.map((c, j) => (
            <span key={j} style={c.accent ? { color: s.accent } : undefined}>
              {c.t}
            </span>
          ))}
        </div>
      ))}
      {d.sub ? (
        <div style={{ ...base, position: "relative", marginTop: t.sub.gap - ((t.lineHeight - 1) / 2) * t.fontPx, fontSize: t.sub.fontPx, ...white }}>
          {d.sub}
        </div>
      ) : null}
    </div>
  );
};

const Main: React.FC<{ s: HudStyle; d: NonNullable<HudFrame["main"]>; white: React.CSSProperties }> = ({ s, d, white }) => {
  const m = s.main;
  const row = (y: number): React.CSSProperties => ({ position: "absolute", left: m.x, top: y, display: "flex", alignItems: "baseline", whiteSpace: "pre" });
  return (
    <div style={{ position: "absolute", inset: 0, opacity: d.a }}>
      <div
        style={{
          ...base,
          left: m.x,
          top: m.tag.y,
          fontSize: m.tag.fontPx,
          ...white,
          background: s.panel,
          padding: `${m.tag.paddingY}px ${m.tag.paddingX}px`,
          borderRadius: m.tag.radius,
        }}
      >
        {m.tag.text}
      </div>
      <div style={row(m.count.y)}>
        <span style={{ fontSize: m.count.fontPx, lineHeight: 1, fontFamily: monoStack, ...white }}>{d.count}</span>
        <span style={{ fontSize: m.count.unitPx, lineHeight: 1, marginLeft: m.count.unitGap, ...white }}>{d.countUnit}</span>
      </div>
      <div style={{ ...base, left: m.x, top: m.label.y, fontSize: m.label.fontPx, ...white }}>{d.label}</div>
      <div style={row(m.value.y)}>
        <span style={{ fontSize: m.value.fontPx, lineHeight: 1, fontFamily: monoStack, ...white }}>{d.value}</span>
        <span style={{ fontSize: m.value.unitPx, lineHeight: 1, marginLeft: m.value.unitGap, ...white }}>{d.unit}</span>
      </div>
      {d.badge ? (
        // 外側で右端を rightX に合わせ、内側を中心から badgeScale 倍する
        <div style={{ position: "absolute", left: m.badge.rightX, top: m.badge.y, transform: "translateX(-100%)" }}>
          <div
            style={{
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
            }}
          >
            {d.badge}
          </div>
        </div>
      ) : null}
    </div>
  );
};

// 名札・吹き出し：(x,y) が指している点。そこから上へ線をのばし、その上に札を中央揃えで乗せる。はみ出すときは札だけ内側へ
const Pointer: React.FC<{
  x: number;
  y: number;
  a: number;
  text: string;
  box: { fontPx: number; stemPx: number; paddingX: number; paddingY: number; radius: number };
  bg: string;
  textStyle: React.CSSProperties;
  stemColor: string;
}> = ({ x, y, a, text, box, bg, textStyle, stemColor }) => {
  const { width: screenW } = useVideoConfig();
  const w = textWidth(text, box.fontPx, sansStack) + box.paddingX * 2;
  const left = Math.min(Math.max(x - w / 2, EDGE), Math.max(EDGE, screenW - EDGE - w));
  const STEM_W = 3;
  return (
    <div style={{ position: "absolute", inset: 0, opacity: a }}>
      <div style={{ position: "absolute", left: x - STEM_W / 2, top: y - box.stemPx, width: STEM_W, height: box.stemPx, background: stemColor }} />
      <div
        style={{
          ...base,
          left,
          top: y - box.stemPx,
          transform: "translateY(-100%)",
          fontSize: box.fontPx,
          ...textStyle,
          background: bg,
          padding: `${box.paddingY}px ${box.paddingX}px`,
          borderRadius: box.radius,
        }}
      >
        {text}
      </div>
    </div>
  );
};
