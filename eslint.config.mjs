import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';

// Custom rule: forbid `@/lib/env` imports from 'use client' files. The env
// module is server-only — it parses the full schema on first access, which
// throws in the browser because server-only NEXT_PUBLIC_-unprefixed keys are
// undefined there. 'use client' files must read `process.env.NEXT_PUBLIC_*`
// literally (so Next inlines them at build time) with an explicit fallback.
// See src/lib/env.ts header for the rationale.
const webnuaPlugin = {
  rules: {
    'no-server-env-in-client': {
      meta: {
        type: 'problem',
        docs: {
          description:
            "Forbid '@/lib/env' imports from 'use client' files — env is server-only and throws in the browser.",
        },
        messages: {
          serverEnvInClient:
            "'@/lib/env' is server-only — importing it from a 'use client' file causes a runtime crash in the browser (the schema includes server-only required keys that are undefined client-side). Read `process.env.NEXT_PUBLIC_*` directly with a fallback instead.",
        },
        schema: [],
      },
      create(context) {
        let isClientFile = false;
        return {
          Program(node) {
            const firstStmt = node.body[0];
            if (
              firstStmt &&
              firstStmt.type === 'ExpressionStatement' &&
              firstStmt.directive === 'use client'
            ) {
              isClientFile = true;
            }
          },
          ImportDeclaration(node) {
            if (!isClientFile) return;
            const src = node.source.value;
            if (src === '@/lib/env' || src === '~/lib/env') {
              context.report({ node, messageId: 'serverEnvInClient' });
            }
          },
        };
      },
    },
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { webnua: webnuaPlugin },
    rules: {
      'webnua/no-server-env-in-client': 'error',
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
]);

export default eslintConfig;
