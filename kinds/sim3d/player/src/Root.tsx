// コンポジションは2つだけ。どのエピソードも同じ再生機で描く（エピソードごとのコードは持たない）
//   mvscene      3D＋HUD
//   mvscene-hud  HUD だけ（透明背景）。別エンジンの映像に重ねる用
// 描くエピソードは render.sh が publicDir の episode/ に置いたもの。
import React, { useEffect, useState } from "react";
import { AbsoluteFill, cancelRender, Composition, continueRender, delayRender } from "remotion";
import { loadEpisode, loadVideoSpec, type Loaded } from "./data";
import { Hud, loadFonts } from "./Hud";
import { Player } from "./Player";

// 場面データ（数 MB）とフォントを読み終えるまで、描画を待たせる
const useLoaded = () => {
  const [handle] = useState(() => delayRender("場面データとフォントを読み込む", { timeoutInMilliseconds: 120000 }));
  const [data, setData] = useState<Loaded | null>(null);
  useEffect(() => {
    loadEpisode()
      .then(async (d) => {
        await loadFonts(d.episode.hud);
        setData(d);
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));
  }, [handle]);
  return data;
};

const Full: React.FC = () => {
  const data = useLoaded();
  if (!data) return null;
  return (
    <AbsoluteFill>
      <Player data={data} />
      <Hud s={data.episode.hud} frames={data.hud.frames} />
    </AbsoluteFill>
  );
};

const HudOnly: React.FC = () => {
  const data = useLoaded();
  if (!data) return null;
  return <Hud s={data.episode.hud} frames={data.hud.frames} />;
};

const calculateMetadata = async () => {
  const v = await loadVideoSpec();
  return { width: v.width, height: v.height, fps: v.fps, durationInFrames: v.frameCount };
};

export const Root: React.FC = () => (
  <>
    {/* 大きさ・長さは scene.json の video から決まる。ここの値は仮 */}
    <Composition id="mvscene" component={Full} width={1080} height={1920} fps={30} durationInFrames={1} calculateMetadata={calculateMetadata} />
    <Composition id="mvscene-hud" component={HudOnly} width={1080} height={1920} fps={30} durationInFrames={1} calculateMetadata={calculateMetadata} />
  </>
);
