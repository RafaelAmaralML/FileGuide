import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier"; // Import Prettier config
import pluginPrettier from "eslint-plugin-prettier"; // Import Prettier plugin

export default [
  // Define file types for ESLint to analyze
  { files: ["**/*.{js,mjs,cjs,ts}"] },
  
  // Set language options for JavaScript files
  { files: ["**/*.js"], languageOptions: { sourceType: "commonjs" } },
  
  // Set global variables to be recognized by ESLint
  { languageOptions: { globals: globals.browser } },
  
  // Extend recommended configurations from ESLint and TypeScript
  pluginJs.configs.recommended, // ESLint recommended
  ...tseslint.configs.recommended, // TypeScript recommended
  
  // Disable conflicting rules between ESLint and Prettier
  prettier, 
  
  // Add Prettier plugin and enforce Prettier's code style rules
  {
    rules: {
      "prettier/prettier": "error", // Ensure Prettier rules are treated as errors
    },
  },
];
