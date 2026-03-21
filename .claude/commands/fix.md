Investigate and fix the bug described by the user. Follow this process:

1. **Reproduce** — Understand the expected vs actual behavior
2. **Locate** — Find the relevant files using grep/find
3. **Diagnose** — Read the code, trace the logic, identify root cause
4. **Fix** — Implement the minimal fix needed
5. **Verify** — Run `npx tsc --noEmit` to ensure no type errors introduced
6. **Summarize** — Explain what was wrong and what was changed

Remember: `'student'` role is legacy — use `'athlete'`.
