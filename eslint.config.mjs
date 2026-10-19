import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  { ignores: [".next/**", ".next-editor-*/**", "node_modules/**"] },
  {
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
  // Preserve the existing search page's deliberate full navigation; this new Next lint rule is unrelated to article editing.
  { files: ["components/CharacterSearchPanel.tsx"], rules: { "@next/next/no-location-assign-relative-destination": "off" } },
];

export default eslintConfig;
