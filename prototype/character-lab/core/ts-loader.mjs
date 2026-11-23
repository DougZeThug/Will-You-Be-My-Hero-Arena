// Tiny Node loader so the TypeScript core runs headless without a build:
// Node >= 22.18 strips types natively; this only resolves the extensionless
// relative imports the sources use.   node --import ./core/ts-loader.mjs <script>
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (
        specifier.startsWith('.') &&
        !/\.[cm]?[jt]s$|\.json$/.test(specifier)
      ) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});
