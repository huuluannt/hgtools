@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"

set "PAUSE_ON_EXIT=1"
if /i "%~1"=="--no-pause" set "PAUSE_ON_EXIT=0"

where git >nul 2>nul
if errorlevel 1 goto :err_no_git

git rev-parse --is-inside-work-tree >nul 2>nul
if errorlevel 1 goto :err_not_repo

set "TARGET_REMOTE=https://github.com/huuluannt/hgltools.git"
set "REMOTE_URL="
for /f "delims=" %%A in ('git remote get-url origin 2^>nul') do set "REMOTE_URL=%%A"

if not defined REMOTE_URL git remote add origin "%TARGET_REMOTE%" >nul 2>nul
if not defined REMOTE_URL if errorlevel 1 goto :err_add_remote

if defined REMOTE_URL if /i not "%REMOTE_URL%"=="%TARGET_REMOTE%" goto :err_wrong_remote

set "BRANCH="
for /f "delims=" %%B in ('git branch --show-current') do set "BRANCH=%%B"
if not defined BRANCH set "BRANCH=master"

echo.
echo ===== Git status =====
git status -sb
echo ======================
echo.

git add -u
if errorlevel 1 goto :err_stage

set "STAGE_FAILED="
for /f "delims=" %%F in ('git ls-files --others --exclude-standard') do call :stage_new_file "%%F" & if errorlevel 1 set "STAGE_FAILED=1"
if defined STAGE_FAILED goto :err_stage_new

git reset -q -- "*.docx" >nul 2>nul

git diff --cached --quiet
if errorlevel 1 goto :do_commit
echo Khong co thay doi de commit.
goto :do_push

:do_commit
for /f "delims=" %%T in ('powershell -NoProfile -Command "Get-Date -Format ''yyyy-MM-dd_HH-mm-ss''"') do set "MSG=deploy %%T"
git commit -m "%MSG%"
if errorlevel 1 goto :err_commit

:do_push
echo.
echo Dang push len origin/%BRANCH% ...
git push -u origin "%BRANCH%"
if errorlevel 1 goto :err_push

echo.
echo [OK] Da deploy len GitHub: https://github.com/huuluannt/hgltools
goto :success_exit

:stage_new_file
set "FILE=%~1"
if /i "%~x1"==".docx" exit /b 0
git add -- "%FILE%"
exit /b %errorlevel%

:err_no_git
echo [ERROR] Git chua duoc cai dat hoac khong nam trong PATH.
echo Cai Git: https://git-scm.com/download/win
goto :error_exit

:err_not_repo
echo [ERROR] Thu muc nay khong phai Git repository.
goto :error_exit

:err_add_remote
echo [ERROR] Khong the them remote origin.
goto :error_exit

:err_wrong_remote
echo [ERROR] Remote origin hien tai khac muc tieu.
echo Hien tai: %REMOTE_URL%
echo Muc tieu:  %TARGET_REMOTE%
echo Hay cap nhat remote bang:
echo   git remote set-url origin %TARGET_REMOTE%
goto :error_exit

:err_stage
echo [ERROR] Khong the stage thay doi (git add).
goto :error_exit

:err_stage_new
echo [ERROR] Khong the stage mot so file moi (untracked).
goto :error_exit

:err_commit
echo [ERROR] Commit that bai.
goto :error_exit

:err_push
echo [ERROR] Push that bai.
echo.
echo Neu repo la PRIVATE, ban can dang nhap GitHub cho Git (PAT/SSH).
echo Cach nhanh: chay lenh duoi day trong terminal de Git mo man hinh dang nhap:
echo   git push -u origin %BRANCH%
goto :error_exit

:error_exit
if "%PAUSE_ON_EXIT%"=="1" pause
exit /b 1

:success_exit
if "%PAUSE_ON_EXIT%"=="1" pause
exit /b 0
