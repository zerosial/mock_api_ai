import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "lib/generated/**/*",
      "node_modules/**/*",
      ".next/**/*",
      "dist/**/*",
      "build/**/*",
      "**/*.js", // JavaScript 파일들 제외
      "**/prisma/**/*.js", // Prisma 관련 JS 파일들
      "**/generated/**/*.js", // 생성된 파일들
    ],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
];

export default eslintConfig;
