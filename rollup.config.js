import path from "path";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import replace from "@rollup/plugin-replace";
import postcss from "rollup-plugin-postcss";
import postcssUrl from "postcss-url";

const output = {
  dir: "dist",
  format: "iife",
};
const plugins = [
  {
    name: "handle-vue-default-import",
    resolveId(source) {
      if (source !== "vue") {
        return null;
      }

      return path.resolve(path.dirname(require.resolve("vue")), "vue.common.js");
    },
  },
  nodeResolve(),
  commonjs(),
  replace({
    "process.env.NODE_ENV": JSON.stringify("production"),
  }),
  postcss({ extract: true, plugins: [postcssUrl({ url: "inline" })] }),
];

export default [
  {
    input: "src/index.js",
    output,
    plugins,
  },
  {
    input: "src/vuetify.js",
    output,
    plugins,
  },
];
