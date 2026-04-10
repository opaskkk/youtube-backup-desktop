!include LogicLib.nsh
!include nsDialogs.nsh

!ifndef BUILD_UNINSTALLER
Var InstallBaseDirInput
Var InstallPreviewLabel

!macro customPageAfterChangeDir
  Page custom InstallDirPageCreate InstallDirPageLeave
!macroend

!macro customFinishPage
  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_NOTCHECKED
  !define MUI_FINISHPAGE_RUN_TEXT "Run YouTube Backup Desktop now"
  !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
  !insertmacro MUI_PAGE_FINISH
!macroend

Function StartApp
  ExecShell "open" "$INSTDIR\YouTube Backup Desktop.exe"
FunctionEnd

Function BuildFinalInstallPath
  Exch $0
  Push $1
  Push $2
  Push $3

  Push $0
  Call NormalizeBaseDir
  Pop $0

  StrLen $1 $0
  ${If} $1 == 0
    StrCpy $0 "$PROGRAMFILES64"
    ${If} $0 == ""
      StrCpy $0 "$PROGRAMFILES"
    ${EndIf}
  ${EndIf}

  StrLen $1 $0
  ${If} $1 > 0
    StrCpy $2 $0 1 -1
    ${If} $2 == "\"
      StrCpy $0 "$0${APP_FILENAME}"
    ${Else}
      StrCpy $0 "$0\${APP_FILENAME}"
    ${EndIf}
  ${EndIf}

  Pop $3
  Pop $2
  Pop $1
  Exch $0
FunctionEnd

Function NormalizeBaseDir
  Exch $0
  Push $1
  Push $2

  loop_trim:
    StrLen $2 $0
    ${If} $2 <= 3
      Goto done_trim
    ${EndIf}
    StrCpy $1 $0 1 -1
    ${If} $1 == "\"
      StrCpy $0 $0 -1
      Goto loop_trim
    ${EndIf}

  done_trim:
  Pop $2
  Pop $1
  Exch $0
FunctionEnd

Function SetBaseDirFromInstDir
  Push $0
  Push $1
  Push $2
  Push $3

  StrCpy $0 $INSTDIR
  StrLen $1 $0
  StrLen $2 "${APP_FILENAME}"
  IntOp $3 $2 + 1

  ${If} $1 > $3
    IntOp $1 $1 - $3
    StrCpy $2 $0 "" $1
    ${If} $2 == "\${APP_FILENAME}"
      StrCpy $0 $0 $1
    ${EndIf}
  ${EndIf}

  Push $0
  Call NormalizeBaseDir
  Pop $0
  StrCpy $INSTDIR $0

  Pop $3
  Pop $2
  Pop $1
  Pop $0
FunctionEnd

Function UpdateInstallPreview
  ${NSD_GetText} $InstallBaseDirInput $0
  Push $0
  Call BuildFinalInstallPath
  Pop $1
  ${NSD_SetText} $InstallPreviewLabel $1
FunctionEnd

Function InstallDirPageOnChange
  Call UpdateInstallPreview
FunctionEnd

Function InstallDirBrowse
  StrCpy $2 "Choose a base folder"
  ${If} $LANGUAGE == 1042
    StrCpy $2 "기준 폴더 선택"
  ${EndIf}

  StrCpy $0 "$INSTDIR"
  ${If} $0 == ""
    StrCpy $0 "$PROGRAMFILES64"
    ${If} $0 == ""
      StrCpy $0 "$PROGRAMFILES"
    ${EndIf}
  ${EndIf}

  nsDialogs::SelectFolderDialog "$2" "$0"
  Pop $1
  ${If} $1 == error
    Return
  ${EndIf}

  ${NSD_SetText} $InstallBaseDirInput $1
  Call UpdateInstallPreview
FunctionEnd

Function InstallDirPageCreate
  Call SetBaseDirFromInstDir

  StrCpy $1 "Choose where to install the app"
  StrCpy $2 "Pick a base folder. The installer will create a YouTube Backup Desktop folder inside it."
  StrCpy $3 "Base folder"
  StrCpy $4 "Browse..."
  StrCpy $5 "Final install location"
  ${If} $LANGUAGE == 1042
    StrCpy $1 "앱을 설치할 위치를 선택하세요"
    StrCpy $2 "기준 폴더를 선택하면 그 아래에 YouTube Backup Desktop 폴더가 생성됩니다."
    StrCpy $3 "기준 폴더"
    StrCpy $4 "찾아보기..."
    StrCpy $5 "최종 설치 위치"
  ${EndIf}

  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 12u "$1"
  Pop $0
  ${NSD_CreateLabel} 0 14u 100% 18u "$2"
  Pop $0

  ${NSD_CreateLabel} 0 40u 100% 12u "$3"
  Pop $0

  ${NSD_CreateDirRequest} 0 56u 78% 12u "$INSTDIR"
  Pop $InstallBaseDirInput
  ${NSD_OnChange} $InstallBaseDirInput InstallDirPageOnChange

  ${NSD_CreateButton} 82% 55u 18% 14u "$4"
  Pop $0
  ${NSD_OnClick} $0 InstallDirBrowse

  ${NSD_CreateLabel} 0 84u 100% 12u "$5"
  Pop $0

  ${NSD_CreateLabel} 0 98u 100% 24u ""
  Pop $InstallPreviewLabel

  Call UpdateInstallPreview

  nsDialogs::Show
FunctionEnd

Function InstallDirPageLeave
  StrCpy $1 "Choose a folder before continuing."
  ${If} $LANGUAGE == 1042
    StrCpy $1 "계속하려면 폴더를 선택하세요."
  ${EndIf}

  ${NSD_GetText} $InstallBaseDirInput $0
  Push $0
  Call NormalizeBaseDir
  Pop $0

  ${If} $0 == ""
    MessageBox MB_OK|MB_ICONEXCLAMATION "$1"
    Abort
  ${EndIf}

  Push $0
  Call BuildFinalInstallPath
  Pop $INSTDIR
FunctionEnd
!else
Var DeleteAppDataCheckbox
Var DeleteAppDataRequested

!macro customUninstallPage
  UninstPage custom un.DeleteAppDataPageCreate un.DeleteAppDataPageLeave
!macroend

Function un.DeleteAppDataPageCreate
  StrCpy $1 "Choose whether to remove saved settings and internal backup data."
  StrCpy $2 "Delete app data too"
  ${If} $LANGUAGE == 1042
    StrCpy $1 "저장된 설정과 내부 백업 데이터도 함께 삭제할지 선택하세요."
    StrCpy $2 "앱 데이터도 함께 삭제"
  ${EndIf}

  nsDialogs::Create 1018
  Pop $0

  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 24u "$1"
  Pop $0

  ${NSD_CreateCheckbox} 0 30u 100% 12u "$2"
  Pop $DeleteAppDataCheckbox
  ${NSD_Uncheck} $DeleteAppDataCheckbox

  nsDialogs::Show
FunctionEnd

Function un.DeleteAppDataPageLeave
  ${NSD_GetState} $DeleteAppDataCheckbox $DeleteAppDataRequested
  ${If} $DeleteAppDataRequested <> ${BST_CHECKED}
    Return
  ${EndIf}

  SetShellVarContext current

  RMDir /r "$APPDATA\${APP_FILENAME}"
  !ifdef APP_PRODUCT_FILENAME
    RMDir /r "$APPDATA\${APP_PRODUCT_FILENAME}"
  !endif
  !ifdef APP_PACKAGE_NAME
    RMDir /r "$APPDATA\${APP_PACKAGE_NAME}"
  !endif
FunctionEnd
!endif
