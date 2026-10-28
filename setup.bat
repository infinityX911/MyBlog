@echo off
REM ── One-click setup: installs deps, syncs DB, adds new permissions ──
cd /d "%~dp0"

echo(
echo [1/5] Installing dependencies (adds web-push)...
call npm install || goto :err

echo(
echo [2/5] Syncing database schema (site_type, youtube_channels, subscribers)...
call npx prisma db push --accept-data-loss || goto :err

echo(
echo [3/5] Generating Prisma client...
call npx prisma generate || goto :err

echo(
echo [4/5] Adding "delete-comments" permission...
call npx prisma db execute --file prisma/manual-migrations/011_delete_comments_permission.sql

echo(
echo [5/5] Adding "use-contact-form" permission...
call npx prisma db execute --file prisma/manual-migrations/012_use_contact_form_permission.sql

echo(
echo ============================================
echo  DONE. Now stop your dev server and run:
echo     npm run dev
echo ============================================
echo(
pause
exit /b 0

:err
echo(
echo !!! Something failed above. Read the error, fix it, and re-run setup.bat
pause
exit /b 1
