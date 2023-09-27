import path from "path";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import replace from "@rollup/plugin-replace";
import postcss from "rollup-plugin-postcss";
import postcssUrl from "postcss-url";

export default [
  {
    input: "src/index.js",
    output: {
      dir: "dist",
      format: "iife",
    },
    plugins: [
      nodeResolve(),
      commonjs(),
      postcss({
        extract: path.resolve("dist/index.css"),
      }),
    ],
  },
  {
    input: "src/dialog.js",
    output: {
      dir: "dist",
      format: "iife",
    },
    plugins: [
      nodeResolve(),
      commonjs(),
    ],
  },
  {
    input: "src/vuetify.js",
    output: {
      dir: "dist",
      format: "iife",
    },
    plugins: [
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
      postcss({
        extract: path.resolve("dist/vuetify.css"),
        plugins: [postcssUrl([{ filter: "**/*.woff2", url: "inline" }])],
      }),
      {
        name: "remove-reset-from-vuetify-styles",
        generateBundle(options, bundle) {
          const start = `/*!
 * ress.css • v2.0.4
 * MIT License
 * github.com/filipelinhares/ress
 */
/* # =================================================================
   # Global selectors
   # ================================================================= */`.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
          const end = `/* # =================================================================
   # Accessibility
   # ================================================================= */`.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
          const regExp = new RegExp(`${start}(.*?)(${end})`, "s");

          for (const [fileName, info] of Object.entries(bundle)) {
            if (fileName.match(/vuetify\.css/)) {
              const input = info.source.toString();
              const output = input.replace(regExp, "$2");

              info.source = output;
            }
          }
        },
      },
    ],
  },
];
