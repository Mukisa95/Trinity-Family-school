@echo off
git add src/app/login/page.tsx LOGIN_PAGE_OPTIMIZATION_SUMMARY.md
git commit -m "perf: Optimize login page - remove 2300ms delays, add lazy loading, simplify animations"
git push origin main
echo.
echo Login page optimizations committed and pushed!
pause

