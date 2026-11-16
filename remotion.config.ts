import { Config } from "@remotion/cli/config";

// どの作り方（kinds/）も、この設定で書き出す。
// publicDir は作り方ごとの書き出しスクリプトが組み、--public-dir で渡す（ここでは決めない）。
// ヘッドレス Chrome で WebGL（three.js）を使うため
Config.setChromiumOpenGlRenderer("angle");
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
