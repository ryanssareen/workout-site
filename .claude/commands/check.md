Run type checking and build to catch all errors. If there are type errors, fix them. Then run lint. Summarize what was found and fixed.

```bash
npx tsc --noEmit 2>&1
npm run build 2>&1
npm run lint 2>&1
```
