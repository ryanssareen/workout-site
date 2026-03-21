Review the component or file at the path provided by the user. Check for:

1. **Type safety** — proper TypeScript types, no `any`, correct null handling
2. **Role-based access** — permissions enforced correctly
3. **Error handling** — loading states, error boundaries, try/catch on async
4. **Firebase best practices** — proper query patterns, no unnecessary reads
5. **UI consistency** — shadcn/ui components, Tailwind patterns, toast notifications
6. **Performance** — unnecessary re-renders, missing `useMemo`/`useCallback` where needed

Provide specific suggestions with code fixes.
