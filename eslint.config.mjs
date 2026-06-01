import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        // React Native / Metro globals
        __DEV__: "readonly",
        require: "readonly",
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { react, "react-hooks": reactHooks },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      // RN/React 17+ JSX transform
      "react/react-in-jsx-scope": "off",

      // reduce noise in this codebase; keep bundling-focused signal
      "no-unused-vars": "off",
      "no-empty": "off",
      "react/prop-types": "off",

      // enable hooks rules so eslint-disable comments don't error
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
